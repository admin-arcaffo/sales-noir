import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type ClerkEmail = {
  id: string;
  email_address: string;
};

function getDisplayName(data: any) {
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return fullName || data.username || null;
}

function getPrimaryEmail(data: any) {
  const emails = (data.email_addresses || []) as ClerkEmail[];
  const primary = emails.find((email) => email.id === data.primary_email_address_id);
  return primary?.email_address || emails[0]?.email_address || null;
}

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request);

    if (event.type === "user.updated" || event.type === "user.created") {
      const data = event.data as any;
      const email = getPrimaryEmail(data);
      const name = getDisplayName(data);

      if (data.id && (email || name)) {
        await prisma.user.updateMany({
          where: { clerkId: data.id },
          data: {
            ...(email ? { email } : {}),
            ...(name ? { name } : {}),
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
