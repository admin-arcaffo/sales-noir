import { inngest } from "./client";
import prisma from "@/lib/prisma";
import OpenAI from "openai";
import { downloadWhatsAppMedia, getWhatsAppMediaUrl } from "@/lib/whatsapp";
import * as fs from "fs";
import * as path from "os";
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
    triggers: [{ event: "whatsapp/audio.received" }],
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
        const tempDir = path.tmpdir();
        const filePath = `${tempDir}/${randomUUID()}.ogg`; // WhatsApp uses OGG
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
      // Can emit another event here like "conversation/analyze-requested"

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
