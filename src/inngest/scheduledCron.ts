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

/**
 * CRON - Auto Move Scheduled Leads
 * 
 * Roda a cada 15 minutos.
 * Verifica os leads na etapa "Agendado" e se a reunião mais recente já passou de 1h30,
 * move automaticamente para a próxima etapa do funil e adiciona uma anotação.
 */
export const autoMoveScheduledLeadsCron = inngest.createFunction(
  {
    id: "auto-move-scheduled-leads-cron",
    name: "Cron — Mover Leads Agendados Pós-Reunião",
    retries: 2,
    triggers: [{ cron: "*/15 * * * *" }], // A cada 15 minutos
  },
  async ({ step }) => {
    // 1. Buscar leads abertos em etapas contendo "agendado"
    const conversations = await step.run("fetch-scheduled-leads", async () => {
      return prisma.conversation.findMany({
        where: {
          status: "OPEN",
          stage: { contains: "agendado", mode: "insensitive" }
        },
        include: {
          contact: {
            include: {
              tasks: {
                where: { type: "MEETING" },
                orderBy: { dueAt: "desc" },
                take: 1
              }
            }
          }
        }
      });
    });

    if (conversations.length === 0) {
      return { success: true, message: "No scheduled leads found in Agendado stage" };
    }

    let movedCount = 0;

    for (const convo of conversations) {
      const latestMeeting = convo.contact.tasks[0];
      if (!latestMeeting || !latestMeeting.dueAt) continue;

      const meetingTime = new Date(latestMeeting.dueAt).getTime();
      const now = Date.now();

      // Verifica se já se passaram 90 minutos (1h30)
      if (now - meetingTime >= 90 * 60 * 1000) {
        await step.run(`move-lead-${convo.id}`, async () => {
          // Buscar as etapas do funil dessa organização
          const orgStages = await prisma.pipelineStage.findMany({
            where: { organizationId: convo.contact.organizationId },
            orderBy: { order: "asc" }
          });

          const currentStageIndex = orgStages.findIndex(s => s.name === convo.stage);
          
          // Se não encontrou a etapa atual, ou já é a última etapa, não faz nada
          if (currentStageIndex === -1 || currentStageIndex === orgStages.length - 1) {
            return;
          }

          const nextStage = orgStages[currentStageIndex + 1];

          // Move o lead para a próxima etapa
          await prisma.conversation.update({
            where: { id: convo.id },
            data: { stage: nextStage.name }
          });

          // Adiciona a anotação interna no lead informando sobre a automação
          const newNote = `[Automação] Lead avançado automaticamente da etapa '${convo.stage}' para '${nextStage.name}' pois já se passaram 1h30 da reunião.`;
          await prisma.contact.update({
            where: { id: convo.contactId },
            data: { 
              notes: convo.contact.notes ? `${convo.contact.notes}\n\n${newNote}` : newNote 
            }
          });
        });
        movedCount++;
      }
    }

    return { success: true, moved: movedCount };
  }
);
