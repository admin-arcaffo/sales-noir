import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { getWhatsAppWorkspaceByPhoneNumberId } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 30;

// Token de verificação que você configura no painel da Meta
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

export async function GET(req: Request) {
  if (!VERIFY_TOKEN) {
    return new Response("Webhook verify token not configured", { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Estrutura básica da API da Meta
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];
    const phoneNumberId = value?.metadata?.phone_number_id || value?.metadata?.phoneNumberId;

    if (message) {
      const phone = message.from;
      const name = contact?.profile?.name || "Cliente WhatsApp";

      if (!phoneNumberId) {
        return NextResponse.json({ error: "Missing phone number id" }, { status: 400 });
      }

      const connection = await getWhatsAppWorkspaceByPhoneNumberId(phoneNumberId);
      const orgId = connection.organizationId;

      const waMessageId = message.id || message.key?.id || null;

      if (waMessageId) {
        const existingMessage = await prisma.message.findUnique({
          where: { waMessageId },
        });

        if (existingMessage) {
          return NextResponse.json({ success: true, deduped: true });
        }
      }

      // 1. Upsert do Contato (Cria se não existir)
      const dbContact = await prisma.contact.upsert({
        where: { phone_organizationId: { phone, organizationId: orgId } },
        update: { name },
        create: {
          phone,
          name,
          organizationId: orgId
        },
      });

      // 2. Garante que existe uma conversa aberta para o contato
      const conversation = await prisma.conversation.findFirst({
        where: {
          contactId: dbContact.id,
          status: "OPEN",
        },
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

      // 3. Salva a mensagem
      const newMessage = await prisma.message.create({
        data: {
          conversationId: activeConversation.id,
          direction: "INBOUND",
          type: message.type.toUpperCase(),
          content: message.text?.body || "",
          waMessageId,
          timestamp: new Date(Number(message.timestamp) * 1000 || Date.now()),
        },
      });

      await prisma.conversation.update({
        where: { id: activeConversation.id },
        data: {
          lastMessageAt: newMessage.timestamp,
        },
      });

      // 4. Se for ÁUDIO, dispara o Inngest para transcrição
      if (message.type === "audio") {
        await inngest.send({
          name: "whatsapp/audio.received",
          data: {
            messageId: newMessage.id,
            mediaId: message.audio.id,
            organizationId: orgId,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
