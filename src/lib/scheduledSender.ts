import prisma from "@/lib/prisma";
import { evolution } from "@/lib/evolution";
import { decryptToken } from "@/lib/encryption";

const PROCESSING_STALE_MS = 10 * 60 * 1000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Erro desconhecido");
}

/**
 * Envia uma mensagem do WhatsApp para um ConversationId especificado sem checar sessão de usuário.
 * Destinado a ser usado exclusivamente por background jobs (Inngest) e actions controladas.
 */
export async function sendScheduledWhatsAppMessage(conversationId: string, content: string) {
  const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, whatsAppConnection: true },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada para o disparo agendado.");
  }

  let connection = conversation.whatsAppConnection;
  if (!connection) {
    connection = await prisma.whatsAppConnection.findFirst({
      where: {
        organizationId: conversation.contact.organizationId,
        status: "CONNECTED",
        isActive: true,
      },
    });
  }

  if (!connection) {
    throw new Error("Nenhuma conexão WhatsApp ativa foi encontrada para esta conversa.");
  }

  if (connection.status !== "CONNECTED") {
    throw new Error("WhatsApp desconectado no momento do disparo.");
  }

  const isEvolution = connection.provider === "EVOLUTION";
  const rawToken = isEvolution ? connection.instanceToken : (connection.accessToken || envWhatsAppToken);

  if (!rawToken || !isEvolution || !connection.instanceName) {
    throw new Error("Conexão WhatsApp sem credenciais válidas para disparo agendado.");
  }

  const decryptedToken = decryptToken(rawToken);
  const result = await evolution.sendText(
    connection.instanceName,
    decryptedToken,
    conversation.contact.phone,
    content
  );

  if (result.error || result.status === 500 || result.status === 400 || result.status === 404) {
    const errorMsg = result.response?.message || result.message || JSON.stringify(result);
    throw new Error(`Evolution API Error: ${errorMsg}`);
  }

  const waMessageId = result.key?.id || result.message?.key?.id || null;
  const waMessageKey = result.key || result.message?.key || null;

  const existingMessage = waMessageId
    ? await prisma.message.findFirst({
      where: { waMessageId, whatsAppConnectionId: connection.id },
      select: { id: true },
    })
    : null;

  const message = existingMessage
    ? await prisma.message.update({
      where: { id: existingMessage.id },
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        type: "TEXT",
        content,
        waMessageKey,
        status: "SENT",
        whatsAppConnectionId: connection.id,
      },
    })
    : await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        type: "TEXT",
        content,
        waMessageId,
        waMessageKey,
        status: "SENT",
        whatsAppConnectionId: connection.id,
      },
    });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: message.timestamp },
  });

  await prisma.integrationLog.create({
    data: {
      connectionId: connection.id,
      event: "OUTBOUND_SCHEDULED_SEND",
      direction: "OUTBOUND",
      payload: result,
      statusCode: 200,
    },
  });

  return { success: true, messageId: message.id, connectionId: connection.id };
}

export async function dispatchScheduledMessage(
  scheduledMessageId: string,
  options: { force?: boolean; includeFailed?: boolean; source?: string } = {}
) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_MS);
  const eligibleStates: any[] = [
    options.force
      ? { status: "PENDING" }
      : { status: "PENDING", scheduledFor: { lte: now } },
    { status: "PROCESSING", lastAttemptAt: { lt: staleBefore } },
  ];

  if (options.includeFailed) {
    eligibleStates.push({ status: "FAILED" });
  }

  const claim = await prisma.scheduledMessage.updateMany({
    where: {
      id: scheduledMessageId,
      OR: eligibleStates,
    },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      lastError: null,
      failedAt: null,
    },
  });

  if (claim.count === 0) {
    const current = await prisma.scheduledMessage.findUnique({
      where: { id: scheduledMessageId },
      select: { id: true, status: true, scheduledFor: true },
    });
    return { success: false, skipped: true, reason: "not_eligible", scheduled: current };
  }

  const active = await prisma.scheduledMessage.findUnique({
    where: { id: scheduledMessageId },
    include: {
      conversation: {
        include: {
          contact: true,
          whatsAppConnection: true,
        },
      },
    },
  });

  if (!active) {
    return { success: false, skipped: true, reason: "not_found" };
  }

  try {
    const sent = await sendScheduledWhatsAppMessage(active.conversationId, active.content);
    await prisma.scheduledMessage.update({
      where: { id: scheduledMessageId },
      data: {
        status: "SENT",
        notified: false,
        sentAt: new Date(),
        failedAt: null,
        lastError: null,
        dispatchMessageId: sent.messageId,
      },
    });

    return { success: true, status: "SENT", messageId: sent.messageId };
  } catch (error) {
    const message = getErrorMessage(error);
    await prisma.scheduledMessage.update({
      where: { id: scheduledMessageId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        lastError: message,
      },
    });

    const connectionId = active.conversation.whatsAppConnectionId;
    if (connectionId) {
      await prisma.integrationLog.create({
        data: {
          connectionId,
          event: "SCHEDULED_DISPATCH_FAILED",
          direction: "OUTBOUND",
          statusCode: 500,
          errorMsg: message,
          payload: {
            scheduledMessageId,
            conversationId: active.conversationId,
            source: options.source || "scheduled-dispatch",
          },
        },
      }).catch(() => null);
    }

    return { success: false, status: "FAILED", error: message };
  }
}
