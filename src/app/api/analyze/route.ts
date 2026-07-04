import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_SALES_COPILOT, AnalysisResponseSchema, type AnalysisResponse } from '@/lib/ai/prompts';
import { saveConversationAnalysis } from '@/actions/crm';
import prisma from '@/lib/prisma';
import { getCurrentWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize OpenAI client
// Note: Requires process.env.OPENAI_API_KEY to be set
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

type AnalyzeMessage = {
  direction: 'inbound' | 'outbound';
  timestamp?: string;
  content?: string;
  transcript?: string;
};

type AnalyzeRequest = {
  conversationId: string;
  messages: AnalyzeMessage[];
  sellerContext?: string;
};

export async function POST(req: Request) {
  try {
    const workspace = await getCurrentWorkspace();
    const body = (await req.json()) as Partial<AnalyzeRequest>;
    const { conversationId, messages, sellerContext } = body;

    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid payload: conversationId is required' },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid payload: messages array is required' },
        { status: 400 }
      );
    }

    // Format the conversation history for the prompt
    const formattedHistory = messages.map(
      (m) => `[${m.timestamp || 'sem horário'}] ${m.direction === 'inbound' ? 'LEAD' : 'VENDEDOR'}: ${m.content || (m.transcript ? `(Áudio transcrito) ${m.transcript}` : '(Mídia/Arquivo)')}`
    ).join('\n');

    // Fetch lead context from DB
    const conversationWithContact = await prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId: workspace.organizationId } },
      include: { contact: { include: { product: true } } },
    });

    let leadContext = '';
    if (conversationWithContact) {
      const c = conversationWithContact.contact;
      const parts: string[] = [];
      parts.push(`Nome: ${c.name}`);
      if (c.phone) parts.push(`Telefone: ${c.phone}`);
      if (c.company) parts.push(`Empresa: ${c.company}`);
      if (c.email) parts.push(`E-mail: ${c.email}`);
      if (c.monthlyRevenue) parts.push(`Faturamento Mensal: R$ ${c.monthlyRevenue.toLocaleString('pt-BR')}`);
      if (c.origin) parts.push(`Origem: ${c.origin}`);
      if (c.potentialValue) parts.push(`Valor Potencial: R$ ${c.potentialValue.toLocaleString('pt-BR')}`);
      if (c.interestArea) parts.push(`Área de Interesse: ${c.interestArea}`);
      parts.push(`Status na base: ${c.isLead ? "Lead" : "Contato"}`);
      if (c.product) parts.push(`Produto de Interesse: ${c.product.name}${c.product.price ? ` (R$ ${c.product.price})` : ''}`);
      if (c.mainChallenges) parts.push(`Desafios Mapeados: ${c.mainChallenges}`);
      if (c.notes) parts.push(`Anotações do Vendedor: ${c.notes}`);
      parts.push(`Estágio Atual: ${conversationWithContact.stage}`);
      parts.push(`Temperatura Atual: ${conversationWithContact.temperature}`);
      
      if (sellerContext) {
        parts.push(`\n[ DIRECIONAMENTO / SITUAÇÃO ATUAL (Pelo Vendedor) ]\n${sellerContext}`);
      }
      
      if (parts.length > 0) {
        leadContext = `\n\n**CONTEXTO DO LEAD:**\n${parts.join('\n')}`;
      }
    }

    const userPrompt = `
Por favor, analise a seguinte conversa comercial.
Siga estritamente as diretrizes do seu System Prompt e retorne o JSON estruturado conforme o schema.
${leadContext}

**HISTÓRICO DA CONVERSA:**
${formattedHistory}
`;

    const activeAnalysisPrompt = await prisma.promptTemplate.findFirst({
      where: {
        organizationId: workspace.organizationId,
        category: 'analysis',
        isActive: true,
      },
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
    });

    const systemPrompt = activeAnalysisPrompt?.content || SYSTEM_PROMPT_SALES_COPILOT;

    // Fetch active pipeline stages from DB to dynamically construct the AI schema
    const pipelineStages = await prisma.pipelineStage.findMany({
      where: { organizationId: workspace.organizationId },
      orderBy: { order: 'asc' },
    });

    const activeStageNames = pipelineStages.length > 0
      ? pipelineStages.map(s => s.name)
      : ["Primeiro Contato", "Qualificação", "Proposta", "Negociação", "Objeção", "Follow-up", "Fechamento", "Reativação"];

    // In a real scenario with a valid API key, we call OpenAI.
    // If no key is present (local testing), we return a robust mock based on the schema.
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key') {
      console.log("No valid OpenAI API key found. Returning mock analysis.");
      
      // Artificial delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult: AnalysisResponse = {
        summary: "O lead demonstrou interesse inicial no escopo, mas apresentou forte resistência em relação ao prazo de entrega e preço final.",
        stage: activeStageNames.includes("Negociação") 
          ? "Negociação" 
          : (activeStageNames[3] || activeStageNames[0]),
        leadClassification: "LEAD_QUENTE",
        urgency: "MEDIA",
        painPoints: ["Gargalo operacional atual", "Falta de previsibilidade"],
        explicitObjections: ["Prazo muito longo", "Custo acima do orçamento"],
        implicitObjections: ["Medo de não receber no prazo", "Dúvida sobre a qualidade da entrega acelerada"],
        buyingSignals: ["Pediu o detalhamento da proposta", "Envolveu o sócio na conversa"],
        riskLevel: "MODERADO",
        recommendedPosture: "Evite focar no preço agora. Ancore o valor da entrega garantida no prazo, mostrando o custo de oportunidade de um projeto mal feito.",
        whatToAvoid: "Não ofereça desconto direto. Não justifique a demora de forma defensiva.",
        nextConcreteStep: "Ligar para o lead para explicar o processo de aceleração e segurança da entrega.",
        timeWindow: "24 horas",
        suggestedReplies: {
          direct: "Entendo a urgência do prazo. Se conseguirmos reduzir a entrega para 15 dias usando uma alocação extra, você consegue avançar no valor atual hoje?",
          consultative: "Faz sentido a preocupação com o prazo. Pela minha experiência, quem acelera esse processo acaba pulando a fase de discovery e entregando errado. O quão crítico é esse prazo frente a qualidade?",
          whatsappShort: "Compreendo. Me diz uma coisa, além do prazo e do orçamento, tem algo mais segurando a decisão de vocês?"
        }
      };

      await saveConversationAnalysis({
        conversationId,
        analysis: mockResult,
      });

      return NextResponse.json({ success: true, data: mockResult });
    }

    // Construct dynamic JSON schema for OpenAI Structured Outputs
    const dynamicAnalysisSchema = {
      name: "commercial_analysis",
      description: "Diagnóstico comercial estratégico para conversas de WhatsApp.",
      strict: true,
      schema: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Resumo executivo da situação comercial atual."
          },
          stage: {
            type: "string",
            enum: activeStageNames,
            description: "Estágio atual da jornada de compra."
          },
          leadClassification: {
            type: "string",
            enum: ["LEAD_FRIO", "LEAD_MORNO", "LEAD_QUENTE", "CLIENTE_NEGOCIACAO", "CLIENTE_TRAVADO", "CLIENTE_PERDIDO", "CLIENTE_FECHADO"],
            description: "Classificação automática da temperatura/status do lead."
          },
          urgency: {
            type: "string",
            enum: ["BAIXA", "MEDIA", "ALTA", "CRITICA"],
            description: "Nível de pressa detectado no lead."
          },
          painPoints: {
            type: "array",
            items: { type: "string" },
            description: "Dores identificadas no processo."
          },
          explicitObjections: {
            type: "array",
            items: { type: "string" },
            description: "Objeções que o lead declarou abertamente."
          },
          implicitObjections: {
            type: "array",
            items: { type: "string" },
            description: "Objeções ocultas ou hesitações percebidas."
          },
          buyingSignals: {
            type: "array",
            items: { type: "string" },
            description: "Indícios de que o lead quer avançar."
          },
          riskLevel: {
            type: "string",
            enum: ["BAIXO", "MODERADO", "ALTO"],
            description: "Risco de perda da oportunidade."
          },
          recommendedPosture: {
            type: "string",
            description: "Tom e postura que o vendedor deve adotar agora."
          },
          whatToAvoid: {
            type: "string",
            description: "Frases ou comportamentos que podem matar a venda agora."
          },
          nextConcreteStep: {
            type: "string",
            description: "Ação imediata recomendada para mover o lead de estágio."
          },
          timeWindow: {
            type: "string",
            description: "Janela de tempo sugerida para executar o próximo passo. Exemplos: hoje, amanhã, 24 horas, 2 dias."
          },
          suggestedReplies: {
            type: "object",
            properties: {
              direct: { type: "string", description: "Versão direta e focada em ação." },
              consultative: { type: "string", description: "Versão consultiva que gera valor/autoridade." },
              whatsappShort: { type: "string", description: "Versão curta e informal para manter o fluxo." }
            },
            required: ["direct", "consultative", "whatsappShort"],
            additionalProperties: false
          }
        },
        required: [
          "summary", 
          "stage", 
          "leadClassification", 
          "urgency", 
          "painPoints", 
          "explicitObjections", 
          "implicitObjections", 
          "buyingSignals", 
          "riskLevel", 
          "recommendedPosture", 
          "whatToAvoid", 
          "nextConcreteStep", 
          "timeWindow",
          "suggestedReplies"
        ],
        additionalProperties: false
      }
    };

    // Actual OpenAI Call using Structured Outputs (GPT-4o)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: dynamicAnalysisSchema
      },
    });

    const resultString = completion.choices[0].message.content;
    
    if (!resultString) {
      throw new Error("Empty response from OpenAI");
    }

    const resultJSON = JSON.parse(resultString) as AnalysisResponse;

    await saveConversationAnalysis({
      conversationId,
      analysis: resultJSON,
    });

    return NextResponse.json({ success: true, data: resultJSON });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error analyzing conversation:', error);
    return NextResponse.json(
      { error: 'Failed to analyze conversation', details: message },
      { status: 500 }
    );
  }
}
