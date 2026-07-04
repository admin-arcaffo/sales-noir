import prisma from "@/lib/prisma";
import { getBrazilianPhoneVariations } from "@/lib/phone";

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

      const contact = await tx.contact.findUnique({
        where: { id: input.contactId },
        select: { phone: true, email: true, organizationId: true },
      });

      let isInternal = false;
      if (contact) {
        const phoneVariations = contact.phone ? getBrazilianPhoneVariations(contact.phone) : [];
        const orClauses: Record<string, unknown>[] = [];
        if (contact.email) orClauses.push({ email: contact.email });
        if (phoneVariations.length) orClauses.push({ phone: { in: phoneVariations } });

        if (orClauses.length > 0) {
          const internalUser = await tx.user.findFirst({
            where: { organizationId: contact.organizationId, OR: orClauses },
            select: { id: true },
          });
          isInternal = !!internalUser;
        }
      }

      if (isInternal) {
        conversation = await tx.conversation.findFirst({
          where: { contactId: input.contactId, status: "OPEN" },
          orderBy: { updatedAt: "desc" },
        });

        if (conversation) return conversation;
      }

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
