import { NextResponse } from "next/server";
import { sendConversationMedia } from "@/actions/crm";
import { normalizeOutboundMediaInput } from "@/lib/outbound-media";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MEDIA_BYTES = Number(process.env.MAX_WHATSAPP_MEDIA_BYTES || 32 * 1024 * 1024);
const MAX_MEDIA_BYTES_BY_TYPE: Record<string, number> = {
  image: Number(process.env.MAX_WHATSAPP_IMAGE_BYTES || 5 * 1024 * 1024),
  audio: Number(process.env.MAX_WHATSAPP_AUDIO_BYTES || 16 * 1024 * 1024),
  video: Number(process.env.MAX_WHATSAPP_VIDEO_BYTES || 16 * 1024 * 1024),
  document: Number(process.env.MAX_WHATSAPP_DOCUMENT_BYTES || 32 * 1024 * 1024),
};

function getMaxMediaBytes(mediaType: string) {
  return Math.min(MAX_MEDIA_BYTES_BY_TYPE[mediaType] || MAX_MEDIA_BYTES, MAX_MEDIA_BYTES);
}

export async function POST(req: Request) {
  let uploadInfo: Record<string, unknown> = {};
  try {
    const formData = await req.formData();
    const conversationId = String(formData.get("conversationId") || "");
    const file = formData.get("file");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const fileName = String(formData.get("fileName") || file.name || "media");
    const normalized = normalizeOutboundMediaInput({
      fileName,
      mimetype: String(formData.get("mimetype") || file.type || "application/octet-stream"),
      mediatype: formData.get("mediatype"),
    });
    const mimetype = normalized.mimetype;
    const mediatype = normalized.mediatype;
    uploadInfo = { conversationId, mediatype, mimetype, fileName, fileSize: file.size };

    const maxBytes = getMaxMediaBytes(mediatype);

    if (file.size > maxBytes) {
      return NextResponse.json({
        error: `Arquivo muito grande para envio direto. Use até ${Math.floor(maxBytes / 1024 / 1024)}MB para ${mediatype}.`,
        ...uploadInfo,
      }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const message = await sendConversationMedia(
      conversationId,
      buffer.toString("base64"),
      mediatype,
      mimetype,
      fileName,
      String(formData.get("caption") || ""),
      String(formData.get("quotedMessageId") || "")
    );

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error("[SEND MEDIA]", error);
    return NextResponse.json({ error: error.message || "Internal server error", ...uploadInfo }, { status: 500 });
  }
}
