
export interface EvolutionInstance {
  instanceName: string;
  instanceId: string;
  status: string;
}

export interface EvolutionQrCodeResponse {
  base64: string;
  code: string;
}

const API_URL = process.env.EVOLUTION_API_URL;
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY;

if (!API_URL) console.warn('[Evolution API] EVOLUTION_API_URL is not set');
if (!GLOBAL_API_KEY) console.warn('[Evolution API] EVOLUTION_API_KEY is not set');

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeEvolutionMediaPayload(value: any) {
  if (typeof value === "string") return { key: { id: value } };
  if (!isRecord(value)) return value;

  if (isRecord(value.key) && isRecord(value.message)) return { key: value.key, message: value.message };
  if (isRecord(value.message) && isRecord(value.message.key) && isRecord(value.message.message)) {
    return { key: value.message.key, message: value.message.message };
  }
  if (isRecord(value.data) && isRecord(value.data.key) && isRecord(value.data.message)) {
    return { key: value.data.key, message: value.data.message };
  }
  if (isRecord(value.record) && isRecord(value.record.key) && isRecord(value.record.message)) {
    return { key: value.record.key, message: value.record.message };
  }

  return value;
}

function hasCompleteEvolutionMediaPayload(value: any) {
  const normalized = normalizeEvolutionMediaPayload(value);
  return isRecord(normalized?.key) && isRecord(normalized?.message);
}

function getEvolutionRecordId(record: any): string | null {
  const normalized = normalizeEvolutionMediaPayload(record);
  return normalized?.key?.id || record?.key?.id || record?.message?.key?.id || record?.id || null;
}

function getEvolutionRemoteJid(value: any): string | null {
  const normalized = normalizeEvolutionMediaPayload(value);
  return normalized?.key?.remoteJid || value?.remoteJid || value?.key?.remoteJid || value?.message?.key?.remoteJid || null;
}

export async function resolveEvolutionMediaPayload(
  instanceName: string,
  instanceToken: string,
  waMessageKey: any,
  waMessageId?: string | null,
  waMessagePayload?: any,
) {
  const storedPayload = normalizeEvolutionMediaPayload(waMessagePayload);
  if (hasCompleteEvolutionMediaPayload(storedPayload)) return storedPayload;

  const keyPayload = normalizeEvolutionMediaPayload(waMessageKey);
  if (hasCompleteEvolutionMediaPayload(keyPayload)) return keyPayload;

  const remoteJid = getEvolutionRemoteJid(keyPayload) || getEvolutionRemoteJid(waMessageKey);

  if (waMessageId) {
    const found = await evolution.findMessageById(instanceName, instanceToken, waMessageId, remoteJid);
    if (found) return normalizeEvolutionMediaPayload(found);
  }

  return keyPayload || waMessageId;
}

/**
 * Cliente para integração com Evolution API v2
 */
export const evolution = {
  /**
   * Cria uma nova instância para uma organização
   */
  createInstance: async (instanceName: string) => {
    if (!API_URL || !GLOBAL_API_KEY) {
      throw new Error("Evolution API not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": GLOBAL_API_KEY,
        },
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          token: crypto.randomUUID(),
          qrcode: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Evolution API Error (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },
  
  /**
   * Deleta uma instância (usando Global API Key)
   */
  deleteInstance: async (instanceName: string) => {
    if (!API_URL || !GLOBAL_API_KEY) {
      throw new Error("Evolution API not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/instance/delete/${instanceName}`, {
        method: "DELETE",
        headers: {
          "apikey": GLOBAL_API_KEY,
        },
        signal: controller.signal,
      });

      return response.ok;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Busca o QR Code de uma instância
   */
  getQrCode: async (instanceName: string, instanceToken: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: {
          "apikey": instanceToken,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to get QR Code (${response.status}): ${text}`);
      }

      const data = await response.json();

      // A Evolution v2 retorna o base64 diretamente ou via objeto
      return {
        base64: data.base64 || data.code?.base64,
        code: data.code?.code || data.code
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Configura o Webhook para uma instância
   */
  setWebhook: async (instanceName: string, instanceToken: string, webhookUrl: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          webhook: {
            url: webhookUrl,
            enabled: true,
            webhookByEvents: false,
            webhookBase64: true,
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "MESSAGES_UPDATE",
              "SEND_MESSAGE"
            ]
          }
        }),
        signal: controller.signal,
      });

      return response.ok;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Envia uma mensagem de texto
   */
  sendText: async (instanceName: string, instanceToken: string, to: string, text: string, quotedMessageId?: string) => {
    if (!API_URL) throw new Error("Evolution API not configured (EVOLUTION_API_URL missing)");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          number: to,
          text: text,
          options: {
            delay: 1200,
            presence: "composing",
            linkPreview: false,
            ...(quotedMessageId ? { quoted: { key: { id: quotedMessageId } } } : {})
          }
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send text (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Envia arquivo multimídia (Imagem, Áudio, Documento, Vídeo)
   */
  sendMedia: async (instanceName: string, instanceToken: string, to: string, base64: string, mediatype: string, mimetype: string, caption?: string, fileName?: string, quotedMessageId?: string) => {
    if (!API_URL) throw new Error("Evolution API not configured (EVOLUTION_API_URL missing)");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${API_URL}/message/sendMedia/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          number: to,
          mediatype,
          mimetype,
          media: base64,
          fileName: fileName || "file",
          caption: caption || undefined,
          options: {
            delay: 1200,
            presence: "composing",
            ...(quotedMessageId ? { quoted: { key: { id: quotedMessageId } } } : {})
          }
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send media (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Apaga uma mensagem para todos
   */
  deleteMessage: async (instanceName: string, instanceToken: string, remoteJid: string, messageId: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/deleteMessageForEveryone/${instanceName}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          id: messageId,
          remoteJid: `${remoteJid}@s.whatsapp.net`,
          fromMe: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete message (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Edita uma mensagem já enviada
   */
  editMessage: async (instanceName: string, instanceToken: string, remoteJid: string, messageId: string, newText: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/updateMessage/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          number: remoteJid,
          key: {
            id: messageId,
            remoteJid: `${remoteJid}@s.whatsapp.net`,
            fromMe: true,
          },
          text: newText,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to edit message (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Envia uma reação (emoji) para uma mensagem
   */
  sendReaction: async (instanceName: string, instanceToken: string, remoteJid: string, messageId: string, emoji: string, fromMe: boolean) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/message/sendReaction/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          key: {
            id: messageId,
            remoteJid: `${remoteJid}@s.whatsapp.net`,
            fromMe,
          },
          reaction: emoji,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send reaction (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Busca perfil completo do número conectado ou de um contato
   */
  fetchProfile: async (instanceName: string, instanceToken: string, number?: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/fetchProfile/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify(number ? { number } : {}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch profile (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Atualiza nome do perfil WhatsApp
   */
  updateProfileName: async (instanceName: string, instanceToken: string, name: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/updateProfileName/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({ name }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update profile name (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Atualiza status (recado) do perfil WhatsApp
   */
  updateProfileStatus: async (instanceName: string, instanceToken: string, status: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/updateProfileStatus/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({ status }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to update profile status (${response.status}): ${errText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Atualiza foto do perfil WhatsApp
   */
  updateProfilePicture: async (instanceName: string, instanceToken: string, pictureBase64: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/updateProfilePicture/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({ picture: pictureBase64 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update profile picture (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Desconecta/logout de uma instância
   */
  disconnectInstance: async (instanceName: string, instanceToken: string) => {
    if (!API_URL) {
      throw new Error("Evolution API not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers: {
          "apikey": instanceToken,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to disconnect instance (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Obtém o status de uma instância
   */
  getInstanceStatus: async (instanceName: string, instanceToken: string) => {
    if (!API_URL) {
      throw new Error("Evolution API not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/instance/connectionState/${instanceName}`, {
        method: "GET",
        headers: {
          "apikey": instanceToken,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch instance status (${response.status}): ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Busca o conteúdo base64 de uma mensagem de mídia usando o ID da mensagem.
   * Este é o método correto para obter mídia — o webhook NÃO envia base64 inline.
   */
  getBase64FromMediaMessage: async (instanceName: string, instanceToken: string, messageObjOrId: any, timeoutMs = 30000): Promise<{ base64: string; mimetype: string } | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const messageBody = normalizeEvolutionMediaPayload(messageObjOrId);

      if (isRecord(messageBody) && !messageBody.message) {
        console.warn(`[EVOLUTION] Media payload has no message body; getBase64FromMediaMessage may fail for ${messageBody.key?.id || messageBody.id || 'unknown-id'}`);
      }

      const response = await fetch(`${API_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          message: messageBody,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.warn(`[EVOLUTION] Failed to fetch media base64: HTTP ${response.status} ${body}`);
        return null;
      }

      const data = await response.json();
      const base64 = data?.base64 || data?.data?.base64 || data?.result?.base64;
      const mimetype = data?.mimetype || data?.mimeType || data?.data?.mimetype || data?.data?.mimeType || data?.result?.mimetype || data?.result?.mimeType;
      if (base64) {
        return {
          base64,
          mimetype: mimetype || "application/octet-stream",
        };
      }
      return null;
    } catch (error) {
      console.error(`[EVOLUTION] Error fetching media base64:`, error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Busca a URL da foto de perfil de um contato
   */
  fetchProfilePictureUrl: async (instanceName: string, instanceToken: string, number: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({ number }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch profile picture URL (${response.status}): ${text}`);
      }

      const data = await response.json();
      return data.profilePictureUrl || null;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Obtém a lista de chats recentes ativos
   */
  findChats: async (instanceName: string, instanceToken: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_URL}/chat/findChats/${instanceName}`, {
        method: "POST", // Many Evolution v2 instances prefer POST for findChats
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch chats (${response.status}): ${text}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn(`[Evolution] findChats failed. Returning empty. ${e}`);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Busca mensagens de um chat específico (remoteJid)
   */
  findMessages: async (instanceName: string, instanceToken: string, remoteJid: string, limit: number = 50) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_URL}/chat/findMessages/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          where: {
            key: { remoteJid }
          }
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch messages for ${remoteJid} (${response.status}): ${text}`);
      }

      const data = await response.json();
      let messages: any[] = [];
      if (Array.isArray(data)) {
        messages = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.messages)) {
          messages = data.messages;
        } else if (data.messages && Array.isArray(data.messages.records)) {
          messages = data.messages.records;
        } else if (Array.isArray(data.records)) {
          messages = data.records;
        }
      }
      
      // API may return all messages or limited. We limit locally just in case.
      return messages.slice(-limit); 
    } catch (e) {
      console.warn(`[Evolution] findMessages failed for ${remoteJid}. Returning empty. ${e}`);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Busca uma mensagem específica. Necessário para recuperar documentos/mídias antigas.
   */
  findMessageById: async (instanceName: string, instanceToken: string, waMessageId: string, remoteJid?: string | null) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const parseMessages = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== "object") return [];
      if (Array.isArray(data.messages)) return data.messages;
      if (data.messages && Array.isArray(data.messages.records)) return data.messages.records;
      if (Array.isArray(data.records)) return data.records;
      return [];
    };

    try {
      const attempts = [
        ...(remoteJid ? [{ where: { key: { remoteJid, id: waMessageId } } }] : []),
        { where: { key: { id: waMessageId } } },
      ];

      for (const body of attempts) {
        const response = await fetch(`${API_URL}/chat/findMessages/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": instanceToken,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) continue;
        const records = parseMessages(await response.json());
        const found = records.find((record) => getEvolutionRecordId(record) === waMessageId);
        if (found) return found;
        if (records.length === 1) return records[0];
      }
    } catch (e) {
      console.warn(`[Evolution] findMessageById failed for ${waMessageId}. ${e}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (remoteJid) {
      const records = await evolution.findMessages(instanceName, instanceToken, remoteJid, 300);
      return records.find((record: any) => getEvolutionRecordId(record) === waMessageId) || null;
    }

    return null;
  }
};
