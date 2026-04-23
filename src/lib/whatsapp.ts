export const WHATSAPP_API_URL = "https://graph.facebook.com/v19.0";

interface SendMessagePayload {
  phoneNumberId: string;
  to: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
  document?: { id: string; filename?: string; caption?: string };
  image?: { id: string; caption?: string };
}

export async function sendWhatsAppMessage(accessToken: string, payload: SendMessagePayload) {
  const { phoneNumberId, to, ...messageData } = payload;
  
  const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...messageData,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp API Error: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

export async function markWhatsAppMessageAsRead(accessToken: string, phoneNumberId: string, messageId: string) {
  const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });

  return response.ok;
}

export async function getWhatsAppMediaUrl(accessToken: string, mediaId: string): Promise<string> {
  const response = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp Media API Error: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data.url;
}

export async function downloadWhatsAppMedia(accessToken: string, mediaUrl: string): Promise<Buffer> {
  const response = await fetch(mediaUrl, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download media from ${mediaUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
