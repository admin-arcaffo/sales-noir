import { NextResponse } from "next/server";
import { createSignedMediaUploadUrl } from "@/lib/media-storage";
import { ensurePaidWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

const MAX_MEDIA_BYTES = Number(process.env.MAX_WHATSAPP_MEDIA_BYTES || 32 * 1024 * 1024);
const MAX_MEDIA_BYTES_BY_TYPE: Record<string, number> = {
  image: Number(process.env.MAX_WHATSAPP_IMAGE_BYTES || 5 * 1024 * 1024),
  audio: Number(process.env.MAX_WHATSAPP_AUDIO_BYTES || 16 * 1024 * 1024),
  video: Number(process.env.MAX_WHATSAPP_VIDEO_BYTES || 16 * 1024 * 1024),
  document: Number(process.env.MAX_WHATSAPP_DOCUMENT_BYTES || 32 * 1024 * 1024),
};

function cleanMimeType(value: unknown) {
  const clean = String(value || "application/octet-stream").split(";")[0].trim().toLowerCase();
  return clean || "application/octet-stream";
}

function getMaxMediaBytes(mediaType: string) {
  return Math.min(MAX_MEDIA_BYTES_BY_TYPE[mediaType] || MAX_MEDIA_BYTES, MAX_MEDIA_BYTES);
}

export async function POST(req: Request) {
  try {
    const workspace = await ensurePaidWorkspace();
    const body = await req.json().catch(() => ({}));
    const fileName = String(body.fileName || "media");
    const mimetype = cleanMimeType(body.mimetype);
    const mediatype = String(body.mediatype || "document").toLowerCase();
    const fileSize = Number(body.fileSize || 0);
    const maxBytes = getMaxMediaBytes(mediatype);

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "fileSize is required" }, { status: 400 });
    }

    if (fileSize > maxBytes) {
      return NextResponse.json({
        error: `Arquivo muito grande. Use até ${Math.floor(maxBytes / 1024 / 1024)}MB para ${mediatype}.`,
        mediatype,
        mimetype,
        fileName,
        fileSize,
      }, { status: 413 });
    }

    const signed = await createSignedMediaUploadUrl({
      organizationId: workspace.organizationId,
      mimeType: mimetype,
      fileName,
    });

    return NextResponse.json({ success: true, ...signed });
  } catch (error: any) {
    console.error("[MEDIA UPLOAD URL]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
