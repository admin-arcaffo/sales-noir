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

export const processAudioTranscript = inngest.createFunction(
  { 
    id: "process-audio-transcript", 
    name: "Transcrição de Áudio via Whisper",
    retries: 3,
    triggers: { event: "whatsapp/audio.received" },
  },
  async ({ event, step }) => {
    const { messageId, mediaId, organizationId } = event.data;

    // 1. Fetch organization WhatsApp token
    const org = await step.run("fetch-org-token", async () => {
      const waConnection = await prisma.whatsAppConnection.findFirst({
        where: { organizationId, status: "CONNECTED" },
      });

      const accessToken = waConnection?.accessToken || envWhatsAppToken;

      if (!waConnection || !accessToken) {
        throw new Error("WhatsApp connection not configured for this organization");
      }

      return { accessToken };
    });

    // 2. Mark transcript as processing
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

    try {
      // 3. Download media from WhatsApp
      const mediaBytes = await step.run("download-audio", async () => {
        const mediaUrl = await getWhatsAppMediaUrl(org.accessToken, mediaId);
        const buffer = await downloadWhatsAppMedia(org.accessToken, mediaUrl);
        return Array.from(buffer.values());
      });

      // 4. Save to temp file (OpenAI requires a File object)
      const tempFilePath = await step.run("save-temp-file", async () => {
        const tempDir = os.tmpdir();
        const filePath = path.join(tempDir, `${randomUUID()}.ogg`); // WhatsApp uses OGG
        fs.writeFileSync(filePath, Buffer.from(mediaBytes));
        return filePath;
      });

       // 5. Send to OpenAI Whisper
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

      // 6. Save transcript to DB
      await step.run("save-transcript", async () => {
        await prisma.audioTranscript.update({
          where: { messageId },
          data: {
            text: transcriptText,
            status: "COMPLETED",
          }
        });
      });

      // 7. Optional: Auto-analyze if it's part of a conversation that needs it
      await step.sendEvent("trigger-analysis", {
        name: "conversation/analyze-requested",
        data: { conversationId: event.data.conversationId || "" } // Need to pass conversationId from webhook
      });

      return { success: true, messageId, transcript: transcriptText };
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error during transcription";
      // Handle failure
      await step.run("mark-failed", async () => {
        await prisma.audioTranscript.update({
          where: { messageId },
          data: {
            status: "FAILED",
            errorMsg: message,
          }
        });
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
    triggers: { event: "conversation/analyze-requested" },
  },
  async ({ event, step }) => {
    const { conversationId, organizationId } = event.data;

    // 1. Fetch conversation history
    const conversation = await step.run("fetch-conversation", async () => {
      return prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { timestamp: "asc" },
            take: 20, // Last 20 messages for context
            include: { transcript: true }
          },
          contact: true
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

    const orchestrator = prompts.find(p => p.category === "orchestrator")?.content || "Analise a conversa de vendas a seguir. Retorne um JSON com: summary, stage, leadClassification (FRIO, MORNO, QUENTE), urgency (ALTA, MEDIA, BAIXA), riskLevel (ALTO, MEDIO, BAIXO), painPoints (array), explicitObjections (array), implicitObjections (array), buyingSignals (array), recommendedPosture, whatToAvoid, nextConcreteStep, timeWindow, e uma suggestedReply.";
    const auxiliaries = prompts.filter(p => p.category === "auxiliary");
    
    let systemPrompt = orchestrator;
    if (auxiliaries.length > 0) {
      systemPrompt += "\n\n=== CONTEXTOS AUXILIARES ===\n";
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
        model: "gpt-4o-mini", // Or gpt-4-turbo
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          ...messageHistory,
          { role: "user", content: "Por favor, analise a conversa até o momento e retorne ESTRITAMENTE o objeto JSON solicitado no prompt do sistema." }
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
    });

    return { success: true, conversationId };
  }
);
