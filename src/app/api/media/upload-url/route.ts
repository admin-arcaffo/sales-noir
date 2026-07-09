import { NextResponse } from "next/server";
import { createSignedMediaUploadUrl } from "@/lib/media-storage";
import { normalizeOutboundMediaInput } from "@/lib/outbound-media";
import { ensurePaidWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

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
  try {
    const workspace = await ensurePaidWorkspace();
    const body = await req.json().catch(() => ({}));
    const fileName = String(body.fileName || "media");
    const normalized = normalizeOutboundMediaInput({
      fileName,
      mimetype: body.mimetype,
      mediatype: body.mediatype,
    });
    const mimetype = normalized.mimetype;
    const mediatype = normalized.mediatype;
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

    return NextResponse.json({
      success: true,
      ...signed,
      mediatype,
      mimetype,
      uploadMimeType: signed.uploadMimeType || normalized.storageMimeType,
    });
  } catch (error: any) {
    console.error("[MEDIA UPLOAD URL]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
