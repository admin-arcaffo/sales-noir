import { inngest } from "./client";
import prisma from "@/lib/prisma";

/**
 * CRON FALLBACK — Rede de Segurança para Mensagens Agendadas
 * 
 * Roda a cada 5 minutos e verifica se há mensagens PENDING cujo 
 * scheduledFor já passou. Se houver, envia imediatamente.
 * 
 * Isso cobre cenários onde o evento original do Inngest falhou
 * (timeout, cold start, bug temporário) e a mensagem ficou "presa".
 */
export const scheduledMessagesCron = inngest.createFunction(
  {
    id: "scheduled-messages-cron-fallback",
    name: "Cron Fallback — Mensagens Agendadas",
    retries: 2,
    triggers: [{ cron: "*/5 * * * *" }], // A cada 5 minutos
  },
  async ({ step }) => {
    // 1. Buscar mensagens PENDING que já deveriam ter sido enviadas
    const overdueMessages = await step.run("fetch-overdue-messages", async () => {
      return prisma.scheduledMessage.findMany({
        where: {
          status: "PENDING",
          scheduledFor: {
            lte: new Date(), // scheduledFor <= agora
          },
        },
        orderBy: { scheduledFor: "asc" },
        take: 20, // Limitar para evitar timeout em caso de muitas mensagens acumuladas
      });
    });

    if (overdueMessages.length === 0) {
      return { success: true, message: "No overdue messages found" };
    }

    console.log(`[CRON FALLBACK] Found ${overdueMessages.length} overdue scheduled messages`);

    let sent = 0;
    let failed = 0;

    // 2. Processar cada mensagem individualmente
    for (const msg of overdueMessages) {
      try {
        await step.run(`send-overdue-${msg.id}`, async () => {
          const { sendScheduledWhatsAppMessage } = await import("@/lib/scheduledSender");
          await sendScheduledWhatsAppMessage(msg.conversationId, msg.content);

          // Marcar como SENT
          await prisma.scheduledMessage.update({
            where: { id: msg.id },
            data: { status: "SENT", notified: false },
          });
        });
        sent++;
      } catch (err) {
        console.error(`[CRON FALLBACK] Failed to send message ${msg.id}:`, err);
        
        await step.run(`mark-failed-${msg.id}`, async () => {
          await prisma.scheduledMessage.update({
            where: { id: msg.id },
            data: { status: "FAILED" },
          });
        });
        failed++;
      }
    }

    return { success: true, sent, failed, total: overdueMessages.length };
  }
);
