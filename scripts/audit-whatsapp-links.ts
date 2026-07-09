import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOULD_FIX = process.argv.includes("--fix");
const SHOULD_FIX_MISMATCHES = process.argv.includes("--fix-mismatches");
const ORG_ID = process.argv.find((arg) => arg.startsWith("--org="))?.replace("--org=", "") || null;

async function main() {
  const orgFilter = ORG_ID ? { organizationId: ORG_ID } : {};

  const conversations = await prisma.conversation.findMany({
    where: { contact: orgFilter },
    select: { id: true, whatsAppConnectionId: true },
  });
  const conversationConnectionById = new Map(conversations.map((conversation) => [conversation.id, conversation.whatsAppConnectionId]));
  const conversationIds = conversations.map((conversation) => conversation.id);

  const messagesWithoutConnection = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      whatsAppConnectionId: null,
      conversation: { whatsAppConnectionId: { not: null } },
    },
    select: { id: true, conversationId: true },
  });

  const mismatchedMessages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      whatsAppConnectionId: { not: null },
    },
    select: { id: true, conversationId: true, whatsAppConnectionId: true, waMessageId: true },
  });

  const mismatches = mismatchedMessages.filter((message) => {
    const conversationConnectionId = conversationConnectionById.get(message.conversationId);
    return Boolean(conversationConnectionId && message.whatsAppConnectionId !== conversationConnectionId);
  });

  const orphanedConversationsWithMessages = await prisma.conversation.count({
    where: {
      contact: orgFilter,
      whatsAppConnectionId: null,
      messages: { some: {} },
    },
  });

  console.log("WhatsApp link audit");
  console.log("Org:", ORG_ID || "ALL");
  console.log("Conversations inspected:", conversations.length);
  console.log("Messages missing connection but conversation has one:", messagesWithoutConnection.length);
  console.log("Messages with connection different from conversation:", mismatches.length);
  console.log("Orphaned conversations with messages:", orphanedConversationsWithMessages);

  if (mismatches.length > 0) {
    console.log("\nSample mismatches:");
    for (const mismatch of mismatches.slice(0, 10)) {
      console.log({
        messageId: mismatch.id,
        waMessageId: mismatch.waMessageId,
        messageConnectionId: mismatch.whatsAppConnectionId,
        conversationConnectionId: conversationConnectionById.get(mismatch.conversationId),
      });
    }
  }

  if (SHOULD_FIX && messagesWithoutConnection.length > 0) {
    let updated = 0;
    for (const message of messagesWithoutConnection) {
      const conversationConnectionId = conversationConnectionById.get(message.conversationId);
      if (!conversationConnectionId) continue;
      await prisma.message.update({
        where: { id: message.id },
        data: { whatsAppConnectionId: conversationConnectionId },
      });
      updated += 1;
    }
    console.log("\nBackfilled message connections:", updated);
  }

  if (SHOULD_FIX_MISMATCHES && mismatches.length > 0) {
    let updated = 0;
    for (const message of mismatches) {
      const conversationConnectionId = conversationConnectionById.get(message.conversationId);
      if (!conversationConnectionId) continue;
      await prisma.message.update({
        where: { id: message.id },
        data: { whatsAppConnectionId: conversationConnectionId },
      });
      updated += 1;
    }
    console.log("\nAligned mismatched message connections:", updated);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
