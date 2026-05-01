
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
        url: webhookUrl,
        enabled: true,
        events: [
          "MESSAGES_UPSERT",
          "CONNECTION_UPDATE",
          "MESSAGES_UPDATE",
          "SEND_MESSAGE"
        ]
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
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false
        },
        textMessage: {
          text
        }
      }),
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
  }
};
