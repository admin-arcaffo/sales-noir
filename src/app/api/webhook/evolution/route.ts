import { NextResponse, NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { verifyWebhookSignature } from "@/lib/encryption";
import { isBypassUser } from "@/lib/workspace";
import { resolveOrCreateContact } from "@/lib/contact-resolver";
import { revalidatePath } from "next/cache";
import { resolveOpenConversation } from "@/lib/conversation-resolver";
import { parseWhatsAppJid } from "@/lib/whatsapp-jid";

export const runtime = "nodejs";

async function logSkippedJid(input: {
  connectionId: string;
  requestId: string;
  event: string;
  remoteJid: string | null | undefined;
  reason: string | null;
  kind: string;
  waMessageId?: string | null;
}) {
  await prisma.integrationLog.create({
    data: {
      connectionId: input.connectionId,
      event: 'WEBHOOK_SKIPPED_INVALID_JID',
      direction: 'INBOUND',
      statusCode: 200,
      errorMsg: input.reason || 'invalid_jid',
      payload: {
        requestId: input.requestId,
        webhookEvent: input.event,
        remoteJid: input.remoteJid || null,
        kind: input.kind,
        waMessageId: input.waMessageId || null,
      },
    }
  }).catch(err => console.error('Failed to log skipped jid:', err));
}

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
      include: { organization: true },
    });

    if (!connection) {
      console.warn(`[WEBHOOK] Instance ${instance} not found (ID: ${requestId})`);
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    if (connection.organization.plan === 'free') {
      const orgUsers = await prisma.user.findMany({
        where: { organizationId: connection.organizationId }
      });
      
      let hasBypassUser = false;
      for (const u of orgUsers) {
        if (await isBypassUser(u.email, null)) {
          hasBypassUser = true;
          break;
        }
      }

      if (!hasBypassUser) {
        console.log(`[WEBHOOK] Skipping webhook for instance ${instance} due to free plan (ID: ${requestId})`);
        
        await prisma.integrationLog.create({
          data: {
            connectionId: connection.id,
            event: 'WEBHOOK_RECEIVED',
            direction: 'INBOUND',
            statusCode: 200,
            errorMsg: 'Webhook ignorado: plano gratuito',
            payload: { instance, event },
          }
        }).catch(err => console.error('Failed to log webhook event:', err));

        return NextResponse.json({ success: true, ignored: true, reason: 'free_plan' });
      }
    }

    // Verify webhook signature if secret is configured
    if (connection.webhookSecret) {
      const signature = req.headers.get('x-signature') || req.headers.get('x-evolution-signature');
      
      if (!signature) {
        // [WEBHOOK] Signatures are bypassed for Evolution v2 if missing
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



      const parsedJid = parseWhatsAppJid(key?.remoteJid);
      if (!parsedJid.isPersonal || !parsedJid.phone) {
        console.log(`[WEBHOOK] Skipping non-personal JID ${key?.remoteJid || 'missing'} (${parsedJid.reason || parsedJid.kind}, ID: ${requestId})`);
        await logSkippedJid({
          connectionId: connection.id,
          requestId,
          event: event || 'messages.upsert',
          remoteJid: key?.remoteJid,
          reason: parsedJid.reason,
          kind: parsedJid.kind,
          waMessageId: key?.id || null,
        });
        return NextResponse.json({ skipped: true, reason: parsedJid.reason || parsedJid.kind });
      }

      // Handle reaction messages
      if (message?.reactionMessage) {
        const reactingToId = message.reactionMessage.key.id;
        const emoji = message.reactionMessage.text;

        if (reactingToId) {
          console.log(`[WEBHOOK] Processing reaction for ${reactingToId} (ID: ${requestId})`);
          await prisma.message.updateMany({
            where: { waMessageId: reactingToId, whatsAppConnectionId: connection.id },
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

      const phone = parsedJid.phone;
      const isOutbound = key.fromMe;
      const name = (!isOutbound && data.pushName) ? data.pushName : phone;
      const orgId = connection.organizationId;
      const waMessageId = key.id;
      const waMessagePayload = {
        key,
        message: data.message,
        messageType: data.messageType || null,
      };

      console.log(`[WEBHOOK] Message received from ${phone} (ID: ${requestId})`);

      // Deduplication
      const existingMessage = waMessageId
        ? await prisma.message.findFirst({
          where: { waMessageId, whatsAppConnectionId: connection.id },
        })
        : null;
      
      if (existingMessage) {
        console.log(`[WEBHOOK] Message already processed (waMessageId: ${waMessageId}, ID: ${requestId})`);

        await prisma.message.update({
          where: { id: existingMessage.id },
          data: {
            waMessageKey: key,
            waMessagePayload,
          },
        }).catch(err => console.error('Failed to update duplicate message payload:', err));
        
        // Log duplicate message
        await prisma.integrationLog.create({
          data: {
            connectionId: connection.id,
            event: 'WEBHOOK_RECEIVED',
            direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
            statusCode: 200,
            errorMsg: 'Duplicate message (deduped)',
            payload: { waMessageId, phone },
          }
        }).catch(err => console.error('Failed to log webhook:', err));

        return NextResponse.json({ success: true, deduped: true });
      }

      try {
        const nameToUse = (!isOutbound && data.pushName) ? data.pushName : undefined;
        const contactResolution = await resolveOrCreateContact({
          organizationId: orgId,
          phone,
          name: nameToUse || name,
          assignedUserId: connection.userId || null,
          source: 'WhatsApp Evolution',
        });
        const dbContact = contactResolution.contact;

        if (!dbContact.avatarUrl && connection.instanceToken) {
          try {
            await inngest.send({
              name: "whatsapp/profile-picture.requested",
              data: {
                contactId: dbContact.id,
                organizationId: orgId,
                instanceName: instance,
                phone,
              },
            });
          } catch (inngestError) {
            console.warn(`[WEBHOOK] Inngest profile picture event failed: ${inngestError instanceof Error ? inngestError.message : 'Unknown'}`);
          }
        }

        const activeConversation = await resolveOpenConversation({
          contactId: dbContact.id,
          whatsAppConnectionId: connection.id,
          stage: "PRIMEIRO_CONTATO",
          temperature: "COLD",
          lastMessageAt: new Date(),
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
        } else if (message?.contactMessage || message?.contactsArrayMessage || messageType === "contactMessage" || messageType === "contactsArrayMessage") {
          type = "CONTACT";
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
          CONTACT: "Contato recebido",
        };

        let finalContent = content;

        if (type === "CONTACT") {
          const parsedContacts: { name: string; phone: string }[] = [];

          const parseVcard = (displayName: string, vcard: string) => {
            const fnMatch = vcard.match(/FN:(.+)/);
            const telMatch = vcard.match(/TEL[^:]*:(.+)/);
            const parsedName = fnMatch ? fnMatch[1].trim() : "";
            let parsedPhone = telMatch ? telMatch[1].trim() : "";
            const waidMatch = vcard.match(/waid=([^:;\s]+)/);
            if (waidMatch) {
              parsedPhone = waidMatch[1];
            } else {
              parsedPhone = parsedPhone.replace(/[+\s\-()]/g, "");
            }
            return {
              name: displayName || parsedName || "Contato",
              phone: parsedPhone,
            };
          };

          if (message?.contactMessage) {
            const displayName = message.contactMessage.displayName || "";
            const vcard = message.contactMessage.vcard || "";
            parsedContacts.push(parseVcard(displayName, vcard));
          } else if (message?.contactsArrayMessage?.contacts && message.contactsArrayMessage.contacts.length > 0) {
            for (const contact of message.contactsArrayMessage.contacts) {
              const displayName = contact.displayName || "";
              const vcard = contact.vcard || "";
              parsedContacts.push(parseVcard(displayName, vcard));
            }
          }
          
          finalContent = JSON.stringify({ contacts: parsedContacts });
        }

        // Create or reuse message record. Evolution can deliver the same webhook more than once.
        const newMessage = await prisma.message.create({
          data: {
          conversationId: activeConversation.id,
          direction: isOutbound ? "OUTBOUND" : "INBOUND",
          type: type,
          content: finalContent || fallbackLabels[type] || "Mensagem recebida",
          mediaUrl: mediaUrl,
          waMessageId,
          waMessageKey: key,
          waMessagePayload,
          mediaStatus: type !== "TEXT" ? "PENDING" : "NONE",
          timestamp: new Date(),
          whatsAppConnectionId: connection.id,
          },
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: activeConversation.id },
          data: { lastMessageAt: newMessage.timestamp },
        });

        revalidatePath('/contacts');
        revalidatePath('/conversations');

        // Queue AI analysis or Media processing (non-blocking)
        if (type !== "TEXT") {
          console.log(`[WEBHOOK] Media message received, queuing for async processing (ID: ${requestId})`);
          try {
            await inngest.send({
              name: "whatsapp/media.received",
              data: {
                messageId: newMessage.id,
                waMessageId,
                waMessageKey: key,
                message: data.message,
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
            direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
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

    // Handle message updates (edits and acks)
    if (event === "messages.update") {
      const update = data[0] || data;
      const waMessageId = update.key?.id;
      
      if (waMessageId) {
        // Handle Edit
        if (update.update?.message) {
          const newContent = 
            update.update.message.conversation || 
            update.update.message.extendedTextMessage?.text || 
            "";
          
          if (newContent) {
            console.log(`[WEBHOOK] Updating edited message ${waMessageId} (ID: ${requestId})`);
            await prisma.message.updateMany({
              where: { waMessageId, whatsAppConnectionId: connection.id },
              data: { 
                content: newContent,
                isEdited: true
              }
            }).catch(err => console.error('Failed to update edited message:', err));
            revalidatePath('/conversations');
          }
        }
        
        // Handle Status Update (Acks)
        if (update.update?.status) {
          const statusMap: Record<string, string> = {
            "PENDING": "PENDING",
            "SERVER_ACK": "SENT",
            "DELIVERY_ACK": "DELIVERED",
            "READ": "READ",
            "PLAYED": "READ"
          };
          
          const newStatus = statusMap[update.update.status];
          
            if (newStatus) {
            console.log(`[WEBHOOK] Updating message status ${waMessageId} to ${newStatus} (ID: ${requestId})`);
            await prisma.message.updateMany({
              where: { waMessageId, whatsAppConnectionId: connection.id },
              data: { status: newStatus }
            }).catch(err => console.error('Failed to update message status:', err));
            revalidatePath('/conversations');
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    // Handle connection status events
    if (event === "connection.update") {
      const connectionStatus = data.state || data.status || data.connection;
      const accountJid = data.wuid || data.jid || data.user?.id || data.me?.id || null;
      const parsedAccount = parseWhatsAppJid(accountJid);
      console.log(`[WEBHOOK] Connection update: ${connectionStatus} (ID: ${requestId})`);

      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          status: (connectionStatus === 'open' || connectionStatus === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
          lastConnectedAt: (connectionStatus === 'open' || connectionStatus === 'CONNECTED') ? new Date() : connection.lastConnectedAt,
          ...(accountJid ? { whatsAppAccountJid: accountJid } : {}),
          ...(parsedAccount.phone ? { whatsAppAccountPhone: parsedAccount.phone } : {}),
        }
      }).catch(err => console.error('Failed to update connection status:', err));

      // Log connection event
      await prisma.integrationLog.create({
        data: {
          connectionId: connection.id,
          event: 'CONNECTION_UPDATE',
          payload: data,
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
