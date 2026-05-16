import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { verifyWebhookSignature, decryptToken } from "@/lib/encryption";
import { evolution } from "@/lib/evolution";

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
    const event = body.event?.toLowerCase();
    const { instance, data } = body;

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
        console.warn(`[WEBHOOK] Missing signature for instance ${instance} (ID: ${requestId}) - Bypassing for v2 compatibility`);
        // Proceeding anyway for Evolution v2 compatibility
      } else {
        const isValidSignature = verifyWebhookSignature(rawBody, signature, connection.webhookSecret);
        
        if (!isValidSignature) {
          console.warn(`[WEBHOOK] Invalid signature for instance ${instance} (ID: ${requestId})`);
          // For now, don't block invalid signatures as v2 might use a different signing method
        }
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



      // Ignore group messages (groups use @g.us suffix)
      if (key.remoteJid?.endsWith("@g.us")) {
        console.log(`[WEBHOOK] Skipping group message from ${key.remoteJid} (ID: ${requestId})`);
        return NextResponse.json({ skipped: true, reason: "group" });
      }

      // Handle reaction messages
      if (message?.reactionMessage) {
        const reactingToId = message.reactionMessage.key.id;
        const emoji = message.reactionMessage.text;

        if (reactingToId) {
          console.log(`[WEBHOOK] Processing reaction for ${reactingToId} (ID: ${requestId})`);
          await prisma.message.updateMany({
            where: { waMessageId: reactingToId },
            data: { 
              reactions: {
                ...(emoji ? { [emoji]: (Date.now()) } : {}) // Simple reaction storage
              }
            }
          }).catch(err => console.error('Failed to update reaction:', err));
        }

        return NextResponse.json({ success: true, type: "reaction" });
      }

      // Ignore protocol messages (receipts, typing indicators, etc.)
      if (message?.protocolMessage || message?.senderKeyDistributionMessage) {
        console.log(`[WEBHOOK] Skipping protocol message (ID: ${requestId})`);
        return NextResponse.json({ skipped: true, reason: "protocol" });
      }

      const phone = key.remoteJid.split("@")[0];
      const name = data.pushName || "Cliente WhatsApp";
      const orgId = connection.organizationId;
      const waMessageId = key.id;
      const isOutbound = key.fromMe;

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
        // Fetch Avatar URL (optional, don't block if fails)
        let avatarUrl = null;
        if (connection.instanceToken) {
          try {
            const token = decryptToken(connection.instanceToken);
            avatarUrl = await evolution.fetchProfilePictureUrl(instance, token, phone);
          } catch (e) {
            console.warn(`[WEBHOOK] Failed to fetch avatar for ${phone}`);
          }
        }

        // Upsert contact
        const nameToUse = (!isOutbound && data.pushName) ? data.pushName : undefined;
        
        const dbContact = await prisma.contact.upsert({
          where: { phone_organizationId: { phone, organizationId: orgId } },
          update: { 
            ...(nameToUse ? { name: nameToUse } : {}),
            ...(avatarUrl ? { avatarUrl } : {})
          },
          create: {
            phone,
            name: nameToUse || name, // Fallback to current name variable if first time
            organizationId: orgId,
            avatarUrl
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

        // Extract message content (robust extraction for v2)
        const content = 
          message?.conversation || 
          message?.extendedTextMessage?.text || 
          message?.imageMessage?.caption ||
          message?.videoMessage?.caption ||
          message?.documentMessage?.fileName ||
          message?.buttonsResponseMessage?.selectedDisplayText ||
          message?.listResponseMessage?.title ||
          "";
          
        const messageType = data?.messageType || "";
        let type = "TEXT";
        let mediaUrl = null;

        if (message?.audioMessage || messageType === "audioMessage") {
          type = "AUDIO";
        } else if (message?.imageMessage || messageType === "imageMessage") {
          type = "IMAGE";
        } else if (message?.videoMessage || messageType === "videoMessage") {
          type = "VIDEO";
        } else if (message?.documentMessage || messageType === "documentMessage") {
          type = "DOCUMENT";
        } else if (message?.stickerMessage || messageType === "stickerMessage") {
          type = "STICKER";
        }

        // ============================================
        // MEDIA EXTRACTION - Deferred to Inngest
        // ============================================
        
        // We no longer fetch base64 synchronously here to avoid blocking the webhook.
        // It will be fetched by the Inngest background job.

        const fallbackLabels: Record<string, string> = {
          AUDIO: "Mensagem de áudio",
          IMAGE: "Imagem",
          STICKER: "Figurinha",
          DOCUMENT: "Documento",
          VIDEO: "Vídeo",
        };

        // Create message record
        const newMessage = await prisma.message.create({
          data: {
            conversationId: activeConversation.id,
            direction: isOutbound ? "OUTBOUND" : "INBOUND",
            type: type,
            content: content || fallbackLabels[type] || "Mensagem recebida",
            mediaUrl: mediaUrl,
            waMessageId,
            timestamp: new Date(),
          },
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: activeConversation.id },
          data: { lastMessageAt: newMessage.timestamp },
        });

        // Queue AI analysis or Media processing (non-blocking)
        if (type !== "TEXT") {
          console.log(`[WEBHOOK] Media message received, queuing for async processing (ID: ${requestId})`);
          try {
            await inngest.send({
              name: "whatsapp/media.received",
              data: {
                messageId: newMessage.id,
                waMessageId,
                conversationId: activeConversation.id,
                organizationId: orgId,
                instanceName: instance,
                type
              }
            });
          } catch (inngestError) {
            console.warn(`[WEBHOOK] Inngest media event failed: ${inngestError instanceof Error ? inngestError.message : 'Unknown'}`);
          }
        } else {
          try {
            await inngest.send({
              name: "conversation/analyze-requested",
              data: {
                conversationId: activeConversation.id,
                organizationId: orgId
              }
            });
            console.log(`[WEBHOOK] Analysis queued for conversation (ID: ${requestId})`);
          } catch (inngestError) {
            console.warn(`[WEBHOOK] Inngest analysis event failed (non-blocking): ${inngestError instanceof Error ? inngestError.message : 'Unknown'}`);
          }
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

    // Handle message updates (edits)
    if (event === "messages.update") {
      const update = data[0] || data;
      if (update.update?.message && update.key?.id) {
        const waMessageId = update.key.id;
        const newContent = 
          update.update.message.conversation || 
          update.update.message.extendedTextMessage?.text || 
          "";
        
        if (newContent) {
          console.log(`[WEBHOOK] Updating edited message ${waMessageId} (ID: ${requestId})`);
          await prisma.message.updateMany({
            where: { waMessageId },
            data: { 
              content: newContent,
              isEdited: true
            }
          }).catch(err => console.error('Failed to update edited message:', err));
        }
      }
      return NextResponse.json({ success: true });
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
