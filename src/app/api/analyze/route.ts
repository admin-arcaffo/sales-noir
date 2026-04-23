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
};

export async function POST(req: Request) {
  try {
    const workspace = await getCurrentWorkspace();
    const body = (await req.json()) as Partial<AnalyzeRequest>;
    const { conversationId, messages } = body;

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

    const userPrompt = `
Por favor, analise a seguinte conversa comercial.
Siga estritamente as diretrizes do seu System Prompt e retorne o JSON estruturado conforme o schema.

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

    // In a real scenario with a valid API key, we call OpenAI.
    // If no key is present (local testing), we return a robust mock based on the schema.
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key') {
      console.log("No valid OpenAI API key found. Returning mock analysis.");
      
      // Artificial delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult: AnalysisResponse = {
        summary: "O lead demonstrou interesse inicial no escopo, mas apresentou forte resistência em relação ao prazo de entrega e preço final.",
        stage: "NEGOCIACAO",
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

    // Actual OpenAI Call using Structured Outputs (GPT-4o)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: AnalysisResponseSchema
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
