import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { evolution } from "@/lib/evolution";
import { getCurrentWorkspace } from "@/lib/workspace";
import { decryptToken } from "@/lib/encryption";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const workspace = await getCurrentWorkspace();
    const { messageId } = params;

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

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

    if (message.mediaUrl) {
      // Já tem a mídia
      return NextResponse.json({ success: true, mediaUrl: message.mediaUrl });
    }

    if (!message.waMessageId) {
      return NextResponse.json({ error: "waMessageId missing, cannot rescue media" }, { status: 400 });
    }

    // Buscar conexão do Evolution ativa
    let connection = await prisma.whatsAppConnection.findFirst({
      where: {
        organizationId: workspace.organizationId,
        isActive: true,
        status: "CONNECTED",
        provider: "EVOLUTION",
      },
    });

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

    // Tentar resgatar base64
    const token = decryptToken(connection.instanceToken);
    const mediaResult = await evolution.getBase64FromMediaMessage(
      connection.instanceName,
      token,
      message.waMessageId
    );

    if (!mediaResult || !mediaResult.base64) {
      return NextResponse.json({ error: "Could not rescue media from Evolution API. Media might have expired." }, { status: 404 });
    }

    const mediaUrl = `data:${mediaResult.mimetype};base64,${mediaResult.base64}`;

    return NextResponse.json({ success: true, mediaUrl });
  } catch (error: any) {
    console.error("[RESCUE MEDIA]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
