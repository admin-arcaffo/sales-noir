import { NextResponse } from "next/server";
import { sendMediaMessage } from "@/actions/crm";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MEDIA_BYTES = Number(process.env.MAX_WHATSAPP_MEDIA_BYTES || 32 * 1024 * 1024);
const MAX_MEDIA_BYTES_BY_TYPE: Record<string, number> = {
  image: Number(process.env.MAX_WHATSAPP_IMAGE_BYTES || 5 * 1024 * 1024),
  audio: Number(process.env.MAX_WHATSAPP_AUDIO_BYTES || 16 * 1024 * 1024),
  video: Number(process.env.MAX_WHATSAPP_VIDEO_BYTES || 16 * 1024 * 1024),
  document: Number(process.env.MAX_WHATSAPP_DOCUMENT_BYTES || 32 * 1024 * 1024),
};

function inferMimeType(fileName: string, mimeType: string) {
  const clean = mimeType && mimeType !== "application/octet-stream" ? mimeType.split(";")[0].trim().toLowerCase() : "";
  if (clean) return clean;

  const ext = fileName.toLowerCase().split(".").pop();
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    opus: "audio/ogg",
    wav: "audio/wav",
    webm: "audio/webm",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4a: "audio/mp4",
  };
  return (ext && byExt[ext]) || "application/octet-stream";
}

function inferMediaType(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

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
    const mimetype = inferMimeType(fileName, String(formData.get("mimetype") || file.type || "application/octet-stream"));
    const mediatype = String(formData.get("mediatype") || inferMediaType(mimetype)).toLowerCase();
    uploadInfo = { conversationId, mediatype, mimetype, fileName, fileSize: file.size };

    const maxBytes = getMaxMediaBytes(mediatype);

    if (file.size > maxBytes) {
      return NextResponse.json({
        error: `Arquivo muito grande para envio direto. Use até ${Math.floor(maxBytes / 1024 / 1024)}MB para ${mediatype}.`,
        ...uploadInfo,
      }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const message = await sendMediaMessage({
      conversationId,
      base64: buffer.toString("base64"),
      mediatype,
      mimetype,
      fileName,
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error("[SEND MEDIA]", error);
    return NextResponse.json({ error: error.message || "Internal server error", ...uploadInfo }, { status: 500 });
  }
}
