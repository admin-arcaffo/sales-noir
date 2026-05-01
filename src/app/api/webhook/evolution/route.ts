import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { verifyWebhookSignature, decryptToken } from "@/lib/encryption";

export const runtime = "nodejs";

/**
 * Evolution API Webhook Handler
 * Receives WhatsApp messages, status updates, and connection events
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { event, instance, data } = body;

    console.log(`[WEBHOOK] Request ID: ${requestId}, Event: ${event}, Instance: ${instance}`);

    // Validate instance exists and get webhook secret
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { instanceName: instance },
    });

    if (!connection) {
      console.warn(`[WEBHOOK] Instance ${instance} not found (ID: ${requestId})`);
      
      // Log failed webhook attempt
      await prisma.integrationLog.create({
        data: {
          connectionId: 'UNKNOWN',
          event: 'WEBHOOK_RECEIVED',
          direction: 'INBOUND',
          statusCode: 404,
          errorMsg: 'Instance not found',
          payload: body,
        }
      }).catch(err => console.error('Failed to log webhook error:', err));

      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Verify webhook signature if secret is configured
    if (connection.webhookSecret) {
      const signature = req.headers.get('x-signature') || req.headers.get('x-evolution-signature');
      
      if (!signature) {
        console.warn(`[WEBHOOK] Missing signature for instance ${instance} (ID: ${requestId})`);
        
        await prisma.integrationLog.create({
          data: {
            connectionId: connection.id,
            event: 'WEBHOOK_RECEIVED',
            direction: 'INBOUND',
            statusCode: 401,
            errorMsg: 'Missing webhook signature',
            payload: body,
          }
        }).catch(err => console.error('Failed to log webhook error:', err));

        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }

      const isValidSignature = verifyWebhookSignature(rawBody, signature, connection.webhookSecret);
      
      if (!isValidSignature) {
        console.warn(`[WEBHOOK] Invalid signature for instance ${instance} (ID: ${requestId})`);
        
        await prisma.integrationLog.create({
          data: {
            connectionId: connection.id,
            event: 'WEBHOOK_RECEIVED',
            direction: 'INBOUND',
            statusCode: 401,
            errorMsg: 'Invalid webhook signature',
            payload: body,
          }
        }).catch(err => console.error('Failed to log webhook error:', err));

        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Mark as connected if this is a messages event
    if (event === "messages.upsert" && connection.status !== "CONNECTED") {
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          status: 'CONNECTED',
          lastConnectedAt: new Date()
        }
      }).catch(err => console.error('Failed to update connection status:', err));
    }

    // Handle message received
    if (event === "messages.upsert") {
      const message = data.message;
      const key = data.key;

      // Ignore messages sent by the app itself
      if (key.fromMe) {
        console.log(`[WEBHOOK] Skipping outbound message (ID: ${requestId})`);
        return NextResponse.json({ skipped: true });
      }

      const phone = key.remoteJid.split("@")[0];
      const name = data.pushName || "Cliente WhatsApp";
      const orgId = connection.organizationId;
      const waMessageId = key.id;

      console.log(`[WEBHOOK] Message received from ${phone} (ID: ${requestId})`);

      // Deduplication
      const existingMessage = await prisma.message.findUnique({
        where: { waMessageId },
      });
      
      if (existingMessage) {
        console.log(`[WEBHOOK] Message already processed (waMessageId: ${waMessageId}, ID: ${requestId})`);
        
        // Log duplicate message
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

      try {
        // Upsert contact
        const dbContact = await prisma.contact.upsert({
          where: { phone_organizationId: { phone, organizationId: orgId } },
          update: { name },
          create: {
            phone,
            name,
            organizationId: orgId
          },
        });

        // Find or create conversation
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

        // Extract message content
        const content = message?.conversation || message?.extendedTextMessage?.text || "";
        const type = message?.audioMessage ? "AUDIO" : "TEXT";

        // Create message record
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

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: activeConversation.id },
          data: { lastMessageAt: newMessage.timestamp },
        });

        // Queue AI analysis
        if (type === "AUDIO") {
          // TODO: Handle audio transcription
          console.log(`[WEBHOOK] Audio message queued for transcription (ID: ${requestId})`);
        } else {
          await inngest.send({
            name: "conversation/analyze-requested",
            data: {
              conversationId: activeConversation.id,
              organizationId: orgId
            }
          });
          console.log(`[WEBHOOK] Analysis queued for conversation (ID: ${requestId})`);
        }

        // Log successful webhook
        await prisma.integrationLog.create({
          data: {
            connectionId: connection.id,
            event: 'WEBHOOK_RECEIVED',
            direction: 'INBOUND',
            statusCode: 200,
            payload: { waMessageId, phone, type },
          }
        }).catch(err => console.error('Failed to log webhook:', err));

      } catch (dbError) {
        console.error(`[WEBHOOK] Database error (ID: ${requestId}):`, dbError);
        
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

    // Handle connection status events
    if (event === "connection.update") {
      const connectionStatus = data.status;
      console.log(`[WEBHOOK] Connection update: ${connectionStatus} (ID: ${requestId})`);

      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          status: connectionStatus === 'open' ? 'CONNECTED' : 'DISCONNECTED',
          lastConnectedAt: connectionStatus === 'open' ? new Date() : connection.lastConnectedAt
        }
      }).catch(err => console.error('Failed to update connection status:', err));

      // Log connection event
      await prisma.integrationLog.create({
        data: {
          connectionId: connection.id,
          event: 'CONNECTION_UPDATE',
          payload: { status: connectionStatus },
        }
      }).catch(err => console.error('Failed to log webhook:', err));
    }

    const processingTime = Date.now() - startTime;
    console.log(`[WEBHOOK] Request completed in ${processingTime}ms (ID: ${requestId})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[WEBHOOK] Error in ${processingTime}ms (ID: ${requestId}):`, error);
    
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
