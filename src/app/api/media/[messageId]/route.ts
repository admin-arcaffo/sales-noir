import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { evolution, resolveEvolutionMediaPayload } from "@/lib/evolution";
import { getCurrentWorkspace } from "@/lib/workspace";
import { decryptToken } from "@/lib/encryption";
import {
  getMediaProxyUrl,
  normalizeBase64Media,
  readStoredMediaBuffer,
  saveMessageMediaFromBase64,
} from "@/lib/media-storage";

export const runtime = "nodejs";

function safeFileName(value: string | null | undefined, fallback: string) {
  return (value || fallback).replace(/[\r\n"\\]/g, "_").slice(0, 180);
}

function contentDisposition(fileName: string, inline: boolean) {
  const disposition = inline ? "inline" : "attachment";
  return `${disposition}; filename="${safeFileName(fileName, "media")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function isTemporaryWhatsAppMediaUrl(value?: string | null) {
  if (!value) return false;
  return value.includes("pps.whatsapp.net") || value.includes("mmg.whatsapp.net") || value.includes(".whatsapp.net/v/");
}

export async function GET(
  req: NextRequest,
  context: { params?: Promise<{ messageId: string }> | { messageId: string } }
) {
  try {
    const url = new URL(req.url);
    const params = context.params ? await context.params : null;
    const messageId = params?.messageId || url.searchParams.get("messageId") || url.searchParams.get("nxtPmessageId");
    const shouldStream = url.searchParams.get("raw") === "1";
    const shouldDownload = url.searchParams.get("download") === "1";

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const workspace = await getCurrentWorkspace();

    // Buscar a mensagem e garantir que pertence a uma conexão desta org
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: {
          contact: {
            organizationId: workspace.organizationId,
          },
        },
      },
      include: {
        media: true,
        conversation: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    let media = message.media;

    if (!media && message.mediaUrl?.startsWith("data:")) {
      const legacy = normalizeBase64Media(message.mediaUrl);
      media = await saveMessageMediaFromBase64({
        organizationId: workspace.organizationId,
        messageId: message.id,
        base64: legacy.base64,
        mimeType: legacy.mimeType || "application/octet-stream",
        originalUrl: null,
      });
    }

    if (!media && message.mediaUrl && !message.mediaUrl.startsWith("data:") && !isTemporaryWhatsAppMediaUrl(message.mediaUrl)) {
      if (shouldStream) {
        return NextResponse.redirect(message.mediaUrl);
      }

      return NextResponse.json({ success: true, mediaUrl: message.mediaUrl });
    }

    if (!media && shouldStream) {
      return new NextResponse("Media is not available yet", { status: 404 });
    }

    if (!media) {
      if (!message.waMessageId) {
        await prisma.message.update({
          where: { id: message.id },
          data: { mediaStatus: "FAILED", mediaError: "waMessageId missing, cannot rescue media" },
        }).catch(() => null);
        return NextResponse.json({ error: "waMessageId missing, cannot rescue media" }, { status: 400 });
      }

      await prisma.message.update({
        where: { id: message.id },
        data: {
          mediaStatus: "PROCESSING",
          mediaError: null,
          mediaAttempts: { increment: 1 },
          mediaLastAttemptAt: new Date(),
        },
      }).catch(() => null);

      // Buscar conexão do Evolution vinculada ou ativa
      let connection = null;
      if (message.conversation?.whatsAppConnectionId) {
        connection = await prisma.whatsAppConnection.findUnique({
          where: { id: message.conversation.whatsAppConnectionId }
        });
      }

      if (!connection) {
        connection = await prisma.whatsAppConnection.findFirst({
          where: {
            organizationId: workspace.organizationId,
            userId: workspace.id,
            isActive: true,
            status: "CONNECTED",
            provider: "EVOLUTION",
          },
        });
      }

      if (!connection) {
        connection = await prisma.whatsAppConnection.findFirst({
          where: {
            organizationId: workspace.organizationId,
            userId: workspace.id,
            status: "CONNECTED",
            provider: "EVOLUTION",
          },
        });
      }

      if (!connection) {
        connection = await prisma.whatsAppConnection.findFirst({
          where: {
            organizationId: workspace.organizationId,
            isActive: true,
            status: "CONNECTED",
            provider: "EVOLUTION",
          },
        });
      }

      if (!connection) {
        connection = await prisma.whatsAppConnection.findFirst({
          where: {
            organizationId: workspace.organizationId,
            status: "CONNECTED",
            provider: "EVOLUTION",
          },
        });
      }

      if (!connection || !connection.instanceName || !connection.instanceToken) {
        return NextResponse.json({ error: "No active Evolution connection found" }, { status: 400 });
      }

      const token = decryptToken(connection.instanceToken);
      const mediaPayload = await resolveEvolutionMediaPayload(
        connection.instanceName,
        token,
        message.waMessageKey,
        message.waMessageId,
        message.waMessagePayload,
      );
      // Try with normal timeout first, then retry with extended timeout
      let mediaResult = await evolution.getBase64FromMediaMessage(
        connection.instanceName,
        token,
        mediaPayload,
        30000,
      );

      // Retry once with longer timeout (audio files can be slow to encode as base64)
      if (!mediaResult || !mediaResult.base64) {
        console.log(`[RESCUE MEDIA] Retrying with extended timeout for ${message.id}`);
        mediaResult = await evolution.getBase64FromMediaMessage(
          connection.instanceName,
          token,
          mediaPayload,
          60000,
        );
      }

      if (!mediaResult || !mediaResult.base64) {
        const errMsg = "Não foi possível resgatar a mídia da Evolution API. A mídia pode ter expirado.";
        await prisma.message.update({
          where: { id: message.id },
          data: { mediaStatus: "FAILED", mediaError: errMsg },
        }).catch(() => null);
        return NextResponse.json({ error: errMsg }, { status: 404 });
      }

      media = await saveMessageMediaFromBase64({
        organizationId: workspace.organizationId,
        messageId: message.id,
        base64: mediaResult.base64,
        mimeType: mediaResult.mimetype,
        originalFileName: message.type === "DOCUMENT" ? message.content : null,
      });

      // Trigger background transcription / analysis via Inngest if it's an audio message
      if (message.type === "AUDIO") {
        try {
          const { inngest } = await import("@/inngest/client");
          await inngest.send({
            name: "whatsapp/media.received",
            data: {
              messageId: message.id,
              waMessageId: message.waMessageId,
              conversationId: message.conversationId,
              organizationId: workspace.organizationId,
              instanceName: connection.instanceName,
              type: "AUDIO",
            },
          });
        } catch (inngestError) {
          console.error("[RESCUE MEDIA] Failed to queue transcription:", inngestError);
        }
      }
    }

    if (!shouldStream) {
      return NextResponse.json({
        success: true,
        mediaUrl: getMediaProxyUrl(message.id),
        mimeType: media.mimeType,
        fileSize: media.fileSize,
      });
    }

    let buffer: Buffer;
    try {
      buffer = await readStoredMediaBuffer(media.storageKey);
    } catch (storageError) {
      console.error(`[MEDIA ROUTE] Stored media read failed for ${message.id} (${media.storageKey}):`, storageError);
      return NextResponse.json(
        { error: "Stored media could not be read", storageKey: media.storageKey },
        { status: 500 }
      );
    }
    const fileName = safeFileName(media.originalFileName || message.content, `${message.id}`);
    const range = req.headers.get("range");

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : buffer.byteLength - 1;
        const safeStart = Math.max(0, Math.min(start, buffer.byteLength - 1));
        const safeEnd = Math.max(safeStart, Math.min(end, buffer.byteLength - 1));
        const chunk = buffer.subarray(safeStart, safeEnd + 1);

        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": media.mimeType,
            "Content-Length": String(chunk.byteLength),
            "Content-Range": `bytes ${safeStart}-${safeEnd}/${buffer.byteLength}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": contentDisposition(fileName, !shouldDownload),
          },
        });
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(buffer.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": contentDisposition(fileName, !shouldDownload),
      },
    });
  } catch (error: any) {
    console.error("[RESCUE MEDIA]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
