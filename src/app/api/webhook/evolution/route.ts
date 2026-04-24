import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, instance, data } = body;

    // 1. Validar se é uma mensagem recebida
    if (event === "messages.upsert") {
      const message = data.message;
      const key = data.key;

      // Ignora mensagens enviadas por mim mesmo
      if (key.fromMe) return NextResponse.json({ skipped: true });

      const phone = key.remoteJid.split("@")[0];
      const name = data.pushName || "Cliente WhatsApp";
      const instanceName = instance;

      // 2. Localizar a Organização pela instância
      const connection = await prisma.whatsAppConnection.findUnique({
        where: { instanceName },
      });

      if (!connection) {
        return NextResponse.json({ error: "Instance not found" }, { status: 404 });
      }

      const orgId = connection.organizationId;
      const waMessageId = key.id;

      // 3. Dedup
      const existingMessage = await prisma.message.findUnique({
        where: { waMessageId },
      });
      if (existingMessage) return NextResponse.json({ success: true, deduped: true });

      // 4. Upsert do Contato
      const dbContact = await prisma.contact.upsert({
        where: { phone_organizationId: { phone, organizationId: orgId } },
        update: { name },
        create: {
          phone,
          name,
          organizationId: orgId
        },
      });

      // 5. Garantir conversa aberta
      const conversation = await prisma.conversation.findFirst({
        where: { contactId: dbContact.id, status: "OPEN" },
        orderBy: { updatedAt: "desc" },
      });

      const activeConversation = conversation || await prisma.conversation.create({
        data: {
          contactId: dbContact.id,
          status: "OPEN",
          stage: "PRIMEIRO_CONTATO",
          temperature: "COLD",
          lastMessageAt: new Date(),
        },
      });

      // 6. Salvar mensagem
      const content = message?.conversation || message?.extendedTextMessage?.text || "";
      const type = message?.audioMessage ? "AUDIO" : "TEXT";

      const newMessage = await prisma.message.create({
        data: {
          conversationId: activeConversation.id,
          direction: "INBOUND",
          type: type,
          content: content,
          waMessageId,
          timestamp: new Date(),
        },
      });

      await prisma.conversation.update({
        where: { id: activeConversation.id },
        data: { lastMessageAt: newMessage.timestamp },
      });

      // 7. Se for ÁUDIO, dispara Inngest
      // (Evolution envia o áudio em base64 ou URL, precisamos tratar depois)
      if (type === "AUDIO") {
         // Lógica de áudio para Evolution...
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Evolution Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
