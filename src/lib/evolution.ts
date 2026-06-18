
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
  sendText: async (instanceName: string, instanceToken: string, to: string, text: string) => {
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
            linkPreview: false
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
  sendMedia: async (instanceName: string, instanceToken: string, to: string, base64: string, mediatype: string, mimetype: string, caption?: string, fileName?: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
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
          caption: caption || "",
          media: base64,
          fileName: fileName || "file",
          options: {
            delay: 1200,
            presence: "composing"
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
  getBase64FromMediaMessage: async (instanceName: string, instanceToken: string, messageId: string): Promise<{ base64: string; mimetype: string } | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          message: {
            key: {
              id: messageId,
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[EVOLUTION] Failed to fetch media base64: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      // A API retorna { base64: "...", mimetype: "..." }
      if (data?.base64) {
        return {
          base64: data.base64,
          mimetype: data.mimetype || "application/octet-stream",
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
      const messages = Array.isArray(data) ? data : (data.messages || []);
      // API may return all messages or limited. We limit locally just in case.
      return messages.slice(-limit); 
    } catch (e) {
      console.warn(`[Evolution] findMessages failed for ${remoteJid}. Returning empty. ${e}`);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }
};
