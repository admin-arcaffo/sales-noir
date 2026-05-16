import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processMediaMessage, analyzeConversation } from "@/inngest/functions";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processMediaMessage,
    analyzeConversation,
  ],
});
