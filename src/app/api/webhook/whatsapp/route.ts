import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { getWhatsAppWorkspaceByPhoneNumberId } from "@/lib/workspace";
import { verifyWebhookSignature } from "@/lib/encryption";

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

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    console.log(`[WEBHOOK-META] Request ID: ${requestId}`);

    // Verify webhook signature if available
    const signature = req.headers.get('x-hub-signature-256');
    if (signature && process.env.WHATSAPP_APP_SECRET) {
      // Format: sha256=xxxxx
      const signatureParts = signature.split('=');
      if (signatureParts.length === 2) {
        const isValid = verifyWebhookSignature(
          rawBody,
          signatureParts[1],
          process.env.WHATSAPP_APP_SECRET
        );

        if (!isValid) {
          console.warn(`[WEBHOOK-META] Invalid signature (ID: ${requestId})`);
          
          await prisma.integrationLog.create({
            data: {
              connectionId: 'UNKNOWN',
              event: 'WEBHOOK_RECEIVED',
              direction: 'INBOUND',
              statusCode: 401,
              errorMsg: 'Invalid webhook signature (Meta)',
              payload: body,
            }
          }).catch(err => console.error('Failed to log webhook error:', err));

          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

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
        console.warn(`[WEBHOOK-META] Missing phone number id (ID: ${requestId})`);
        return NextResponse.json({ error: "Missing phone number id" }, { status: 400 });
      }

      const connection = await getWhatsAppWorkspaceByPhoneNumberId(phoneNumberId);
      const orgId = connection.organizationId;

      const waMessageId = message.id || message.key?.id || null;

      console.log(`[WEBHOOK-META] Message from ${phone} (ID: ${requestId})`);

      if (waMessageId) {
        const existingMessage = await prisma.message.findUnique({
          where: { waMessageId },
        });

        if (existingMessage) {
          console.log(`[WEBHOOK-META] Message deduped (waMessageId: ${waMessageId}, ID: ${requestId})`);
          
          await prisma.integrationLog.create({
            data: {
              connectionId: connection.id,
              event: 'WEBHOOK_RECEIVED',
              direction: 'INBOUND',
              statusCode: 200,
              errorMsg: 'Duplicate message (deduped)',
              payload: { waMessageId, phone },
            }
          }).catch(err => console.error('Failed to log webhook:', err));

          return NextResponse.json({ success: true, deduped: true });
        }
      }

      try {
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

        // Log successful webhook
        await prisma.integrationLog.create({
          data: {
            connectionId: connection.id,
            event: 'WEBHOOK_RECEIVED',
            direction: 'INBOUND',
            statusCode: 200,
            payload: { waMessageId, phone, type: message.type },
          }
        }).catch(err => console.error('Failed to log webhook:', err));

      } catch (dbError) {
        console.error(`[WEBHOOK-META] Database error (ID: ${requestId}):`, dbError);
        
        await prisma.integrationLog.create({
          data: {
            connectionId: connection.id,
            event: 'WEBHOOK_RECEIVED',
            direction: 'INBOUND',
            statusCode: 500,
            errorMsg: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
            payload: body,
          }
        }).catch(err => console.error('Failed to log webhook error:', err));

        throw dbError;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`[WEBHOOK-META] Request completed in ${processingTime}ms (ID: ${requestId})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[WEBHOOK-META] Error in ${processingTime}ms (ID: ${requestId}):`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

