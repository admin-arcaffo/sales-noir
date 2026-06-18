import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processMediaMessage, analyzeConversation, sendScheduledMessage } from "@/inngest/functions";
import { scheduledMessagesCron } from "@/inngest/scheduledCron";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processMediaMessage,
    analyzeConversation,
    sendScheduledMessage,
    scheduledMessagesCron,
  ],
});
