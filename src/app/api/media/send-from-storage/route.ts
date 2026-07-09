import { NextResponse } from "next/server";
import { sendConversationMedia } from "@/actions/crm";
import { assertOrganizationStorageKey, readStoredMediaBase64 } from "@/lib/media-storage";
import { normalizeOutboundMediaInput } from "@/lib/outbound-media";
import { ensurePaidWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const uploadInfo: Record<string, unknown> = {};
  try {
    const workspace = await ensurePaidWorkspace();
    const body = await req.json().catch(() => ({}));
    const conversationId = String(body.conversationId || "");
    const storageKey = String(body.storageKey || "");
    const fileName = String(body.fileName || "media");
    const normalized = normalizeOutboundMediaInput({
      fileName,
      mimetype: body.mimetype,
      mediatype: body.mediatype,
    });
    const mediatype = normalized.mediatype;
    const mimetype = normalized.mimetype;

    Object.assign(uploadInfo, { conversationId, storageKey, mediatype, mimetype, fileName });

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    assertOrganizationStorageKey(workspace.organizationId, storageKey);

    const base64 = await readStoredMediaBase64(storageKey);
    const message = await sendConversationMedia(
      conversationId,
      base64,
      mediatype,
      mimetype,
      fileName,
      String(body.caption || ""),
      String(body.quotedMessageId || "")
    );

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error("[SEND MEDIA FROM STORAGE]", error);
    return NextResponse.json({ error: error.message || "Internal server error", ...uploadInfo }, { status: 500 });
  }
}
