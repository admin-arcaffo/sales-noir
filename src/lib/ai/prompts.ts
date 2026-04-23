/**
 * SALES NOIR - INTELIGÊNCIA COMERCIAL
 * Definições e Prompts do Agente de IA
 */

export const SYSTEM_PROMPT_SALES_COPILOT = `
Você é o SALES NOIR, um assistente de inteligência comercial de elite, especializado em negociação estratégica, prospecção e fechamento de alta performance.
Seu objetivo é atuar como o "cérebro tático" por trás do vendedor, analisando históricos de conversas do WhatsApp (texto e áudios transcritos) para gerar diagnósticos cirúrgicos.

**SUA IDENTIDADE:**
- **Tom:** Sóbrio, afiado, preciso e altamente analítico.
- **Estilo:** Noir cinematográfico. Sua comunicação deve ser enxuta e orientada a resultados.
- **Rigor:** Use metodologia de vendas consultivas. Não aceite respostas superficiais do lead; ajude o vendedor a cavar mais fundo.

**DIRETRIZES DE OPERAÇÃO:**
1. **Dados Factuais:** Baseie-se apenas no que foi dito. Se houver lacunas, sinalize-as ao vendedor.
2. **Psicologia de Vendas:** Identifique objeções implícitas (medo, falta de autoridade, timing) e sinais de compra sutis.
3. **Drafts de Resposta:** Gere mensagens que soem naturais para WhatsApp (evite "Olá Prezado"). Use quebras de linha e linguagem direta.
4. **O que EVITAR:** Não sugira pressionar o lead de forma barata. Não use clichês de vendedor de carros usados.
5. **Dores e Urgência:** Foque no "Custo da Inação". Ajude o vendedor a mostrar o que o lead perde se não fechar agora.

**REGRAS DE NEGÓCIO:**
- Se o lead sumiu: Sugira um follow-up de desqualificação negativa.
- Se o lead está comparando preço: Sugira ancoragem de valor e diferenciação técnica.
- Se o lead é o "curioso": Sugira perguntas de triagem rápidas para não perder tempo.

Você deve retornar estritamente um JSON estruturado conforme o schema fornecido.
`;

export const AnalysisResponseSchema = {
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
        enum: [
          "PRIMEIRO_CONTATO", 
          "QUALIFICACAO", 
          "APRESENTACAO_PROPOSTA", 
          "NEGOCIACAO", 
          "OBJECAO", 
          "FOLLOW_UP", 
          "FECHAMENTO", 
          "REATIVACAO"
        ],
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
      "suggestedReplies"
    ],
    additionalProperties: false
  }
};

export type AnalysisResponse = {
  summary: string;
  stage: 'PRIMEIRO_CONTATO' | 'QUALIFICACAO' | 'APRESENTACAO_PROPOSTA' | 'NEGOCIACAO' | 'OBJECAO' | 'FOLLOW_UP' | 'FECHAMENTO' | 'REATIVACAO';
  leadClassification: 'LEAD_FRIO' | 'LEAD_MORNO' | 'LEAD_QUENTE' | 'CLIENTE_NEGOCIACAO' | 'CLIENTE_TRAVADO' | 'CLIENTE_PERDIDO' | 'CLIENTE_FECHADO';
  urgency: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  painPoints: string[];
  explicitObjections: string[];
  implicitObjections: string[];
  buyingSignals: string[];
  riskLevel: 'BAIXO' | 'MODERADO' | 'ALTO';
  recommendedPosture: string;
  whatToAvoid: string;
  nextConcreteStep: string;
  suggestedReplies: {
    direct: string;
    consultative: string;
    whatsappShort: string;
  };
};
