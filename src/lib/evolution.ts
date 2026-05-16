
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

    const response = await fetch(`${API_URL}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": GLOBAL_API_KEY,
      },
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        token: Math.random().toString(36).substring(2, 15), // Gera um token aleatório para a instância
        qrcode: true,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Evolution API Error: ${data.message || JSON.stringify(data)}`);
    }

    return data;
  },
  
  /**
   * Deleta uma instância (usando Global API Key)
   */
  deleteInstance: async (instanceName: string) => {
    if (!API_URL || !GLOBAL_API_KEY) {
      throw new Error("Evolution API not configured");
    }

    const response = await fetch(`${API_URL}/instance/delete/${instanceName}`, {
      method: "DELETE",
      headers: {
        "apikey": GLOBAL_API_KEY,
      },
    });

    return response.ok;
  },

  /**
   * Busca o QR Code de uma instância
   */
  getQrCode: async (instanceName: string, instanceToken: string) => {
    const response = await fetch(`${API_URL}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: {
        "apikey": instanceToken,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to get QR Code: ${data.message || JSON.stringify(data)}`);
    }

    // A Evolution v2 retorna o base64 diretamente ou via objeto
    return {
      base64: data.base64 || data.code?.base64,
      code: data.code?.code || data.code
    };
  },

  /**
   * Configura o Webhook para uma instância
   */
  setWebhook: async (instanceName: string, instanceToken: string, webhookUrl: string) => {
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
    });

    return response.ok;
  },

  /**
   * Envia uma mensagem de texto
   */
  sendText: async (instanceName: string, instanceToken: string, to: string, text: string) => {
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
    });

    return response.json();
  },

  /**
   * Envia arquivo multimídia (Imagem, Áudio, Documento, Vídeo)
   */
  sendMedia: async (instanceName: string, instanceToken: string, to: string, base64: string, mediatype: string, mimetype: string, caption?: string, fileName?: string) => {
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
    });

    return response.json();
  },

  /**
   * Apaga uma mensagem para todos
   */
  deleteMessage: async (instanceName: string, instanceToken: string, remoteJid: string, messageId: string) => {
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
    });
    return response.json();
  },

  /**
   * Edita uma mensagem já enviada
   */
  editMessage: async (instanceName: string, instanceToken: string, remoteJid: string, messageId: string, newText: string) => {
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
    });
    return response.json();
  },

  /**
   * Envia uma reação (emoji) para uma mensagem
   */
  sendReaction: async (instanceName: string, instanceToken: string, remoteJid: string, messageId: string, emoji: string, fromMe: boolean) => {
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
    });
    return response.json();
  },

  /**
   * Busca perfil completo do número conectado ou de um contato
   */
  fetchProfile: async (instanceName: string, instanceToken: string, number?: string) => {
    const response = await fetch(`${API_URL}/chat/fetchProfile/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify(number ? { number } : {}),
    });
    return response.json();
  },

  /**
   * Atualiza nome do perfil WhatsApp
   */
  updateProfileName: async (instanceName: string, instanceToken: string, name: string) => {
    const response = await fetch(`${API_URL}/chat/updateProfileName/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({ name }),
    });
    return response.json();
  },

  /**
   * Atualiza status (recado) do perfil WhatsApp
   */
  updateProfileStatus: async (instanceName: string, instanceToken: string, status: string) => {
    const response = await fetch(`${API_URL}/chat/updateProfileStatus/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({ status }),
    });
    return response.json();
  },

  /**
   * Atualiza foto do perfil WhatsApp
   */
  updateProfilePicture: async (instanceName: string, instanceToken: string, pictureBase64: string) => {
    const response = await fetch(`${API_URL}/chat/updateProfilePicture/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({ picture: pictureBase64 }),
    });
    return response.json();
  },

  /**
   * Desconecta/logout de uma instância
   */
  disconnectInstance: async (instanceName: string, instanceToken: string) => {
    if (!API_URL) {
      throw new Error("Evolution API not configured");
    }

    const response = await fetch(`${API_URL}/instance/logout/${instanceName}`, {
      method: "DELETE",
      headers: {
        "apikey": instanceToken,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Failed to disconnect instance: ${data.message || JSON.stringify(data)}`);
    }

    return response.json();
  },

  /**
   * Obtém o status de uma instância
   */
  getInstanceStatus: async (instanceName: string, instanceToken: string) => {
    if (!API_URL) {
      throw new Error("Evolution API not configured");
    }

    const response = await fetch(`${API_URL}/instance/fetch/${instanceName}`, {
      method: "GET",
      headers: {
        "apikey": instanceToken,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch instance status: ${data.message || JSON.stringify(data)}`);
    }

    return data;
  },

  /**
   * Busca o conteúdo base64 de uma mensagem de mídia usando o ID da mensagem.
   * Este é o método correto para obter mídia — o webhook NÃO envia base64 inline.
   */
  getBase64FromMediaMessage: async (instanceName: string, instanceToken: string, messageId: string): Promise<{ base64: string; mimetype: string } | null> => {
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
    }
  },

  /**
   * Busca a URL da foto de perfil de um contato
   */
  fetchProfilePictureUrl: async (instanceName: string, instanceToken: string, number: string) => {
    const response = await fetch(`${API_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({ number }),
    });

    const data = await response.json();
    return data.profilePictureUrl || null;
  }
};
