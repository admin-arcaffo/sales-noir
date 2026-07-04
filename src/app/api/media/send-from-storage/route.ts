import { NextResponse } from "next/server";
import { sendMediaMessage } from "@/actions/crm";
import { assertOrganizationStorageKey, readStoredMediaBase64 } from "@/lib/media-storage";
import { ensurePaidWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

function cleanMimeType(value: unknown) {
  const clean = String(value || "application/octet-stream").split(";")[0].trim().toLowerCase();
  return clean || "application/octet-stream";
}

export async function POST(req: Request) {
  const uploadInfo: Record<string, unknown> = {};
  try {
    const workspace = await ensurePaidWorkspace();
    const body = await req.json().catch(() => ({}));
    const conversationId = String(body.conversationId || "");
    const storageKey = String(body.storageKey || "");
    const mediatype = String(body.mediatype || "document").toLowerCase();
    const mimetype = cleanMimeType(body.mimetype);
    const fileName = String(body.fileName || "media");

    Object.assign(uploadInfo, { conversationId, storageKey, mediatype, mimetype, fileName });

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    assertOrganizationStorageKey(workspace.organizationId, storageKey);

    const base64 = await readStoredMediaBase64(storageKey);
    const message = await sendMediaMessage({
      conversationId,
      base64,
      mediatype,
      mimetype,
      fileName,
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error("[SEND MEDIA FROM STORAGE]", error);
    return NextResponse.json({ error: error.message || "Internal server error", ...uploadInfo }, { status: 500 });
  }
}
