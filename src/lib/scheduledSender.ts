import prisma from "@/lib/prisma";
import { evolution } from "@/lib/evolution";
import { decryptToken } from "@/lib/encryption";

/**
 * Envia uma mensagem do WhatsApp para um ConversationId especificado sem checar sessão de usuário.
 * Destinado a ser usado exclusivamente por background jobs (Inngest).
 */
export async function sendScheduledWhatsAppMessage(conversationId: string, content: string) {
  const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";

  // 1. Encontrar a conversa
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // 2. Encontrar a conexão vinculada ou ativa da organização
  let connection = null;
  if (conversation.whatsAppConnectionId) {
    connection = await prisma.whatsAppConnection.findUnique({
      where: { id: conversation.whatsAppConnectionId }
    });
  }
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
    throw new Error("WhatsApp connection not configured or not active");
  }

  // 3. Obter token
  const isEvolution = connection.provider === "EVOLUTION";
  const rawToken = isEvolution ? connection.instanceToken : (connection.accessToken || envWhatsAppToken);

  if (!rawToken || !isEvolution || !connection.instanceName) {
    throw new Error("Currently only Evolution API is supported for background jobs");
  }

  const accessToken: string = rawToken;
  const decryptedToken = decryptToken(accessToken);

  // 4. Enviar mensagem via Evolution
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

  // 5. Salvar a mensagem no banco de dados
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: "TEXT",
      content,
      waMessageId,
    },
  });

  // 6. Atualizar timestamp da última mensagem na conversa
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: message.timestamp },
  });

  // 7. Salvar log de integração
  await prisma.integrationLog.create({
    data: {
      connectionId: connection.id,
      event: "OUTBOUND_SCHEDULED_SEND",
      direction: "OUTBOUND",
      payload: result,
      statusCode: 200,
    },
  });

  return { success: true, messageId: message.id };
}
