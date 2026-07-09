import prisma from "@/lib/prisma";

type ResolveOpenConversationInput = {
  contactId: string;
  whatsAppConnectionId?: string | null;
  stage?: string;
  temperature?: string;
  lastMessageAt?: Date;
  replaceConnection?: boolean;
};

export async function resolveOpenConversation(input: ResolveOpenConversationInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ locked: number }[]>`
      WITH lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${input.contactId}))
      )
      SELECT 1::int AS locked FROM lock
    `;

    if (input.whatsAppConnectionId) {
      let conversation = await tx.conversation.findFirst({
        where: { contactId: input.contactId, status: "OPEN", whatsAppConnectionId: input.whatsAppConnectionId },
        orderBy: { updatedAt: "desc" },
      });

      if (conversation) return conversation;

      return tx.conversation.create({
        data: {
          contactId: input.contactId,
          status: "OPEN",
          stage: input.stage || "PRIMEIRO_CONTATO",
          temperature: input.temperature || "COLD",
          lastMessageAt: input.lastMessageAt || new Date(),
          whatsAppConnectionId: input.whatsAppConnectionId,
        },
      });
    }

    let conversation = await tx.conversation.findFirst({
      where: { contactId: input.contactId, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      return tx.conversation.create({
        data: {
          contactId: input.contactId,
          status: "OPEN",
          stage: input.stage || "PRIMEIRO_CONTATO",
          temperature: input.temperature || "COLD",
          lastMessageAt: input.lastMessageAt || new Date(),
        },
      });
    }

    return conversation;
  });
}
