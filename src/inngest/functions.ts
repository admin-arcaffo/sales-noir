import { inngest } from "./client";
import prisma from "@/lib/prisma";
import OpenAI from "openai";
import { downloadWhatsAppMedia, getWhatsAppMediaUrl } from "@/lib/whatsapp";
import * as fs from "fs";
import * as os from "os";
import path from "path";
import { randomUUID } from "crypto";

// Initialize OpenAI client lazily to avoid issues during builds when API key might not be available
let openaiInstance: OpenAI | null = null;

const getOpenAI = () => {
  if (!openaiInstance && process.env.OPENAI_API_KEY) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
};

const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";

import { decryptToken } from "@/lib/encryption";
import { evolution } from "@/lib/evolution";

export const processMediaMessage = inngest.createFunction(
  { 
    id: "process-media-message", 
    name: "Processamento de Mídia e Transcrição",
    retries: 3,
    triggers: [{ event: "whatsapp/media.received" }],
  },
  async ({ event, step }) => {
    const { messageId, waMessageId, conversationId, organizationId, instanceName, type } = event.data;

    // 1. Fetch connection to get token
    const connection = await step.run("fetch-connection", async () => {
      const waConnection = await prisma.whatsAppConnection.findFirst({
        where: { organizationId, instanceName, status: "CONNECTED" },
      });

      if (!waConnection || !waConnection.instanceToken) {
        throw new Error("WhatsApp connection not configured or missing token");
      }

      return { instanceToken: waConnection.instanceToken };
    });

    try {
      // 2. Fetch media base64 from Evolution
      const mediaResult = await step.run("fetch-media-base64", async () => {
        const token = decryptToken(connection.instanceToken);
        return await evolution.getBase64FromMediaMessage(instanceName, token, waMessageId);
      });

      if (!mediaResult || !mediaResult.base64) {
        throw new Error("No media returned from Evolution API");
      }

      const mediaUrl = `data:${mediaResult.mimetype};base64,${mediaResult.base64}`;

      // 3. Update message with media URL
      await step.run("update-message-media", async () => {
        await prisma.message.update({
          where: { id: messageId },
          data: { mediaUrl }
        });
      });

      // Se não for áudio, encerramos aqui e acionamos a análise
      if (type !== "AUDIO") {
        await step.sendEvent("trigger-analysis", {
          name: "conversation/analyze-requested",
          data: { conversationId, organizationId }
        });
        return { success: true, messageId, type, transcribed: false };
      }

      // === PROCESSO DE TRANSCRIÇÃO DE ÁUDIO ===

      // 4. Mark transcript as processing
      await step.run("update-transcript-status", async () => {
        await prisma.audioTranscript.upsert({
          where: { messageId },
          update: { status: "PROCESSING" },
          create: {
            messageId,
            text: "",
            status: "PROCESSING"
          }
        });
      });

      // 5. Save to temp file (OpenAI requires a File object)
      const tempFilePath = await step.run("save-temp-file", async () => {
        const tempDir = os.tmpdir();
        // Determine extension
        let ext = ".ogg";
        if (mediaResult.mimetype.includes("mp4")) ext = ".mp4";
        if (mediaResult.mimetype.includes("mpeg")) ext = ".mp3";
        if (mediaResult.mimetype.includes("wav")) ext = ".wav";
        if (mediaResult.mimetype.includes("webm")) ext = ".webm";

        const filePath = path.join(tempDir, `${randomUUID()}${ext}`); 
        const buffer = Buffer.from(mediaResult.base64, 'base64');
        fs.writeFileSync(filePath, buffer);
        return filePath;
      });

      // 6. Send to OpenAI Whisper
      const transcriptText = await step.run("whisper-transcription", async () => {
        try {
          const openai = getOpenAI();
          if (!openai) {
            throw new Error("OPENAI_API_KEY not configured");
          }
          const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "pt", // Força português, pode ser ajustado
          });

          return response.text;
        } finally {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }
      });

      // 7. Save transcript to DB
      await step.run("save-transcript", async () => {
        await prisma.audioTranscript.update({
          where: { messageId },
          data: {
            text: transcriptText,
            status: "COMPLETED",
          }
        });
      });

      // 8. Auto-analyze the conversation now that we have the transcript
      await step.sendEvent("trigger-analysis", {
        name: "conversation/analyze-requested",
        data: { conversationId, organizationId }
      });

      return { success: true, messageId, transcript: transcriptText };
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error during media/transcription processing";
      
      // Handle failure for audio
      if (type === "AUDIO") {
        await step.run("mark-failed", async () => {
          await prisma.audioTranscript.upsert({
            where: { messageId },
            update: {
              status: "FAILED",
              errorMsg: message,
            },
            create: {
              messageId,
              text: "",
              status: "FAILED",
              errorMsg: message,
            }
          });
        });
      }
      
      // Still trigger analysis even if media/audio failed
      await step.sendEvent("trigger-analysis-fallback", {
        name: "conversation/analyze-requested",
        data: { conversationId, organizationId }
      });

      throw error; // Let Inngest retry
    }
  }
);

export const analyzeConversation = inngest.createFunction(
  { 
    id: "analyze-conversation", 
    name: "Análise de Vendas via OpenAI",
    retries: 2,
    triggers: [{ event: "conversation/analyze-requested" }],
  },
  async ({ event, step }) => {
    const { conversationId, organizationId, sellerContext } = event.data;

    // 1. Fetch conversation history + contact enrichment
    const conversation = await step.run("fetch-conversation", async () => {
      return prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { timestamp: "asc" },
            take: 30,
            include: { transcript: true }
          },
          contact: {
            include: { product: true }
          }
        }
      });
    });

    if (!conversation) throw new Error("Conversation not found");

    // 2. Fetch Prompts (Orchestrator + Auxiliary)
    const prompts = await step.run("fetch-prompts", async () => {
      const orgId = organizationId || conversation.contact.organizationId;
      return prisma.promptTemplate.findMany({
        where: { 
          organizationId: orgId,
          isActive: true
        }
      });
    });

    const orchestrator = prompts.find(p => p.category === "orchestrator")?.content || "Analise a conversa de vendas a seguir. Retorne um JSON com: summary, stage, leadClassification (LEAD_FRIO, LEAD_MORNO, LEAD_QUENTE, CLIENTE_NEGOCIACAO, CLIENTE_TRAVADO, CLIENTE_PERDIDO, CLIENTE_FECHADO), urgency (BAIXA, MEDIA, ALTA, CRITICA), riskLevel (BAIXO, MODERADO, ALTO), painPoints (array), explicitObjections (array), implicitObjections (array), buyingSignals (array), recommendedPosture, whatToAvoid, nextConcreteStep, timeWindow, e uma suggestedReply.";
    const auxiliaries = prompts.filter(p => p.category === "auxiliary");
    
    // Build enriched system prompt with lead context
    let systemPrompt = orchestrator;

    // --- Inject Lead Context ---
    const contact = conversation.contact;
    const leadContextParts: string[] = [];
    leadContextParts.push(`Nome: ${contact.name}`);
    if (contact.phone) leadContextParts.push(`Telefone: ${contact.phone}`);
    if (contact.company) leadContextParts.push(`Empresa: ${contact.company}`);
    if (contact.email) leadContextParts.push(`E-mail: ${contact.email}`);
    if (contact.monthlyRevenue) leadContextParts.push(`Faturamento Mensal: R$ ${contact.monthlyRevenue.toLocaleString('pt-BR')}`);
    if (contact.origin) leadContextParts.push(`Origem: ${contact.origin}`);
    if (contact.potentialValue) leadContextParts.push(`Valor Potencial: R$ ${contact.potentialValue.toLocaleString('pt-BR')}`);
    if (contact.interestArea) leadContextParts.push(`Área de Interesse: ${contact.interestArea}`);
    leadContextParts.push(`Status na base: ${contact.isLead ? "Lead" : "Contato"}`);
    if (contact.product) leadContextParts.push(`Produto de Interesse: ${contact.product.name}${contact.product.price ? ` (R$ ${contact.product.price})` : ''}`);
    if (contact.mainChallenges) leadContextParts.push(`Desafios Mapeados: ${contact.mainChallenges}`);
    if (contact.notes) leadContextParts.push(`Anotações do Vendedor: ${contact.notes}`);
    leadContextParts.push(`Estágio Atual: ${conversation.stage}`);
    leadContextParts.push(`Temperatura Atual: ${conversation.temperature}`);
    
    if (sellerContext) {
      leadContextParts.push(`\n[ DIRECIONAMENTO / SITUAÇÃO ATUAL (Pelo Vendedor) ]\n${sellerContext}`);
    }

    systemPrompt += `\n\n=== CONTEXTO DO LEAD ===\n${leadContextParts.join('\n')}\n`;

    if (auxiliaries.length > 0) {
      systemPrompt += "\n=== CONTEXTOS AUXILIARES ===\n";
      auxiliaries.forEach(aux => {
        systemPrompt += `\n--- ${aux.name} ---\n${aux.content}\n`;
      });
    }

    // 3. Prepare messages for OpenAI
    const messageHistory = conversation.messages.map(m => {
      const role = m.direction === "INBOUND" ? "user" : "assistant";
      const content = m.type === "AUDIO" && m.transcript?.text ? `[ÁUDIO TRANSCRITO]: ${m.transcript.text}` : m.content || "[Mídia não suportada]";
      return { role: role as "user" | "assistant", content };
    });

    // 4. Call OpenAI
    const analysisResult = await step.run("openai-analysis", async () => {
      const openai = getOpenAI();
      if (!openai) throw new Error("OPENAI_API_KEY not configured");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          ...messageHistory,
          { role: "user", content: "Por favor, analise a conversa até o momento considerando o contexto do lead fornecido e retorne ESTRITAMENTE o objeto JSON solicitado no prompt do sistema." }
        ]
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response from OpenAI");
      
      return JSON.parse(content);
    });

    // 5. Save Analysis to DB
    await step.run("save-analysis", async () => {
      // Find the first user in the org to assign the analysis
      const user = await prisma.user.findFirst({
        where: { organizationId: conversation.contact.organizationId }
      });

      if (!user) return; // Silent skip if no user

      const analysis = await prisma.aIAnalysis.create({
        data: {
          conversationId,
          userId: user.id,
          summary: analysisResult.summary || "Resumo não gerado",
          stage: analysisResult.stage || conversation.stage,
          leadClassification: analysisResult.leadClassification || "FRIO",
          urgency: analysisResult.urgency || "BAIXA",
          riskLevel: analysisResult.riskLevel || "BAIXO",
          painPoints: analysisResult.painPoints || [],
          explicitObjections: analysisResult.explicitObjections || [],
          implicitObjections: analysisResult.implicitObjections || [],
          buyingSignals: analysisResult.buyingSignals || [],
          recommendedPosture: analysisResult.recommendedPosture || "",
          whatToAvoid: analysisResult.whatToAvoid || "",
          nextConcreteStep: analysisResult.nextConcreteStep || "",
          timeWindow: analysisResult.timeWindow || "24h",
          messageCount: conversation.messages.length,
          processingTimeMs: 0, // Could calculate duration
        }
      });

      if (analysisResult.suggestedReply) {
        await prisma.suggestedReply.create({
          data: {
            analysisId: analysis.id,
            type: "DIRECT",
            content: typeof analysisResult.suggestedReply === "string" ? analysisResult.suggestedReply : JSON.stringify(analysisResult.suggestedReply),
          }
        });
      }

      // --- AUTO-UPDATE: Temperature & Stage from AI ---
      const classificationToTemperature: Record<string, string> = {
        LEAD_FRIO: 'COLD', FRIO: 'COLD',
        LEAD_MORNO: 'WARM', MORNO: 'WARM',
        LEAD_QUENTE: 'HOT', QUENTE: 'HOT',
        CLIENTE_NEGOCIACAO: 'HOT',
        CLIENTE_TRAVADO: 'WARM',
        CLIENTE_PERDIDO: 'COLD',
        CLIENTE_FECHADO: 'HOT',
      };

      const newTemp = classificationToTemperature[analysisResult.leadClassification] || conversation.temperature;
      const newStage = analysisResult.stage || conversation.stage;

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { temperature: newTemp, stage: newStage },
      });
    });

    return { success: true, conversationId };
  }
);

export const sendScheduledMessage = inngest.createFunction(
  { 
    id: "send-scheduled-message", 
    name: "Disparo de Mensagem Agendada",
    retries: 3,
    triggers: [{ event: "message/scheduled-dispatch" }],
  },
  async ({ event, step }) => {
    const { scheduledMessageId } = event.data;

    // 1. Fetch scheduled message details
    const scheduled = await step.run("fetch-scheduled-message", async () => {
      return prisma.scheduledMessage.findUnique({
        where: { id: scheduledMessageId },
      });
    });

    if (!scheduled || scheduled.status !== "PENDING") {
      return { success: false, reason: "Message no longer pending or not found" };
    }

    // 2. Sleep until the scheduled time
    await step.sleepUntil("wait-until-scheduled-time", scheduled.scheduledFor);

    // 3. Re-verify in DB (in case it was deleted or updated)
    const active = await step.run("verify-scheduled-message", async () => {
      return prisma.scheduledMessage.findUnique({
        where: { id: scheduledMessageId },
      });
    });

    if (!active || active.status !== "PENDING") {
      return { success: false, reason: "Message was cancelled or updated" };
    }

    try {
      // 4. Send the message
      await step.run("send-whatsapp-message", async () => {
        const { sendScheduledWhatsAppMessage } = await import("@/lib/scheduledSender");
        await sendScheduledWhatsAppMessage(active.conversationId, active.content);
      });

      // 5. Update status to SENT
      await step.run("mark-sent", async () => {
        await prisma.scheduledMessage.update({
          where: { id: scheduledMessageId },
          data: { status: "SENT", notified: false },
        });
      });

      return { success: true };
    } catch (err: any) {
      // 6. Update status to FAILED
      await step.run("mark-failed", async () => {
        await prisma.scheduledMessage.update({
          where: { id: scheduledMessageId },
          data: { status: "FAILED" },
        });
      });
      throw err;
    }
  }
);
