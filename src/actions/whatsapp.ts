'use server';

import { evolution } from '@/lib/evolution';
import prisma from '@/lib/prisma';
import { getCurrentWorkspace, ensurePaidWorkspace } from '@/lib/workspace';
import { revalidatePath } from 'next/cache';
import { encryptToken, generateWebhookSecret } from '@/lib/encryption';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ATTEMPTS_PER_DAY = 5;

function getWebhookUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'https://dealeto.arcaffo.com';
  const normalized = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  return `${normalized.replace(/\/$/, '')}/api/webhook/evolution`;
}

async function checkRateLimit(orgId: string, userId: string): Promise<{ allowed: boolean; error?: string }> {
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId, userId }
  });

  if (!connection) {
    return { allowed: true };
  }

  const lastAttemptTime = connection.lastConnectionAttemptAt?.getTime() || 0;
  const now = Date.now();
  const timeSinceLastAttempt = now - lastAttemptTime;

  // Reset counter if outside the time window
  if (timeSinceLastAttempt > RATE_LIMIT_WINDOW_MS) {
    return { allowed: true };
  }

  // Check if max attempts exceeded
  if (connection.connectionAttempts >= MAX_ATTEMPTS_PER_DAY) {
    const resetTime = new Date(lastAttemptTime + RATE_LIMIT_WINDOW_MS);
    return {
      allowed: false,
      error: `Rate limit exceeded. Try again after ${resetTime.toISOString()}`
    };
  }

  return { allowed: true };
}

export async function createWhatsAppInstance() {
  try {
    const workspace = await ensurePaidWorkspace();
    const orgId = workspace.organizationId;

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(orgId, workspace.id);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for org ${orgId}: ${rateLimitCheck.error}`);
      return { error: rateLimitCheck.error || "Too many connection attempts. Please try again later." };
    }

    if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
      console.error("ERRO: Variáveis EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no Vercel.");
      return { error: "Configuração da API de WhatsApp pendente no servidor." };
    }

    const suffix = Math.random().toString(36).substring(2, 6);
    const instanceName = `noir-${orgId.slice(0, 8)}-${suffix}`;
    console.log(`Iniciando criação de instância: ${instanceName}`);

    // Create instance on Evolution API
    let result: any;
    try {
      result = await evolution.createInstance(instanceName);
    } catch (error: any) {
      if (error.message.includes("already in use")) {
        console.log(`Instância ${instanceName} já existe. Recriando...`);
        // We don't have the token to logout/delete properly via API if it's lost, 
        // but Evolution v2 allows deletion with Global API Key on some endpoints or we can just try to fetch it.
        // Best approach: try to delete it first using a specialized delete call if available.
        try {
          // Se a instância acabou de ser deletada, a API pode demorar uns segundos para liberar o nome
          await evolution.deleteInstance(instanceName);
          console.log(`Aguardando limpeza da instância ${instanceName}...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds delay
          
          result = await evolution.createInstance(instanceName);
        } catch (deleteError) {
          throw error; // throw original if delete-recreate fails
        }
      } else {
        throw error;
      }
    }
    console.log("Instância criada na Evolution com sucesso");
    
    // Encrypt the instance token before storage
    const encryptedToken = encryptToken(result.hash);
    const webhookSecret = generateWebhookSecret();
    
    // Look for existing connection
    const existingConnection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId, userId: workspace.id }
    });

    if (existingConnection && existingConnection.instanceName) {
      try {
        console.log(`Deletando instância antiga da Evolution API para evitar vazamento: ${existingConnection.instanceName}`);
        await evolution.deleteInstance(existingConnection.instanceName);
      } catch (err) {
        console.warn(`Erro ao deletar instância antiga ${existingConnection.instanceName}:`, err);
      }
    }

    const data = {
      provider: 'EVOLUTION',
      instanceName: instanceName,
      instanceToken: encryptedToken, // Store encrypted
      webhookSecret: webhookSecret, // For HMAC verification
      status: 'DISCONNECTED',
      isActive: true,
      qrCodeCreatedAt: new Date(), // Track when QR was generated
      connectionAttempts: (existingConnection?.connectionAttempts || 0) + 1,
      lastConnectionAttemptAt: new Date()
    };

    // Save or update in database
    if (existingConnection) {
      await prisma.whatsAppConnection.update({
        where: { id: existingConnection.id },
        data
      });
    } else {
      await prisma.whatsAppConnection.create({
        data: {
          ...data,
          organizationId: orgId,
          userId: workspace.id
        }
      });
    }

    // Configure webhook automatically
    const webhookUrl = getWebhookUrl();
    console.log(`Configurando Webhook: ${webhookUrl}`);
    await evolution.setWebhook(instanceName, result.hash, webhookUrl);

    revalidatePath('/settings');
    return { success: true, instanceName };
  } catch (error: any) {
    console.error("Falha detalhada ao criar instância WhatsApp:", error?.message || error);
    return { error: "Falha ao conectar com o servidor de WhatsApp. Verifique as configurações." };
  }
}


export async function getWhatsAppQrCode(instanceName: string) {
  try {
    if (!instanceName) {
      return { error: "Dados da instância inválidos." };
    }

    const workspace = await ensurePaidWorkspace();
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { 
        organizationId: workspace.organizationId,
        userId: workspace.id,
        instanceName: instanceName
      }
    });

    if (!connection || !connection.instanceToken) {
      return { error: "Instância não encontrada." };
    }

    // Removed local QR code expiration check. We'll always attempt to get the latest from Evolution API.

    // Decrypt the token before using it
    const { decryptToken } = await import('@/lib/encryption');
    let decryptedToken: string;
    try {
      decryptedToken = decryptToken(connection.instanceToken);
    } catch (error) {
      console.error('Failed to decrypt token:', error);
      return { error: "Erro ao descriptografar credenciais." };
    }

    const qrData = await evolution.getQrCode(instanceName, decryptedToken);
    return qrData;
  } catch (error: any) {
    console.error("Erro ao buscar QR Code:", error?.message || error);
    return { error: "Não foi possível carregar o QR Code. Tente novamente." };
  }
}

export async function getWhatsAppStatus() {
  try {
    const workspace = await ensurePaidWorkspace();
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { 
        organizationId: workspace.organizationId,
        userId: workspace.id,
        provider: 'EVOLUTION'
      }
    });

    if (!connection) {
      return { status: 'DISCONNECTED' };
    }

    let currentStatus = connection.status;

    // Self-Healing Status Sync: Query the live status from the Evolution API
    if (connection.provider === 'EVOLUTION' && connection.instanceName && connection.instanceToken) {
      try {
        const { decryptToken } = await import('@/lib/encryption');
        const token = decryptToken(connection.instanceToken);
        const statusData = await evolution.getInstanceStatus(connection.instanceName, token);
        const evolutionState = statusData?.instance?.state || statusData?.state;
        
        const newStatus = (evolutionState === 'open' || evolutionState === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED';
        
        if (newStatus !== connection.status) {
          const updated = await prisma.whatsAppConnection.update({
            where: { id: connection.id },
            data: { 
              status: newStatus,
              lastConnectedAt: newStatus === 'CONNECTED' ? new Date() : connection.lastConnectedAt
            }
          });
          currentStatus = updated.status;
          console.log(`[STATUS-SYNC] Automatically updated status to ${newStatus} for ${connection.instanceName}`);
        }
      } catch (err) {
        console.warn('[STATUS-SYNC] Failed to fetch live status from Evolution API:', err);
      }
    }

    // Don't return encrypted token to client
    const { instanceToken, accessToken, ...safeConnection } = connection;
    return {
      ...safeConnection,
      status: currentStatus
    };
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    return { status: 'ERROR', error: 'Failed to get status' };
  }
}

export async function disconnectWhatsApp(deleteHistory = false) {
  try {
    const workspace = await ensurePaidWorkspace();
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { 
        organizationId: workspace.organizationId,
        userId: workspace.id,
        provider: 'EVOLUTION'
      }
    });

    if (!connection) {
      return { error: "Conexão não encontrada." };
    }

    // Delete the instance completely on Evolution API
    if (connection.instanceName) {
      try {
        await evolution.deleteInstance(connection.instanceName);
      } catch (error) {
        console.error('Evolution API deleteInstance error:', error);
      }
    }

    if (deleteHistory) {
      // Isolar exclusão apenas para conversas pertencentes à conexão sendo desconectada
      const userConversations = await prisma.conversation.findMany({
        where: { whatsAppConnectionId: connection.id },
        select: { id: true }
      });
      
      const conversationIds = userConversations.map(c => c.id);
      
      if (conversationIds.length > 0) {
        // Deletar apenas histórico de mensagens e análises de IA (mantém registros e estágios intactos no pipeline)
        await prisma.message.deleteMany({
          where: { conversationId: { in: conversationIds } }
        });
        
        await prisma.aIAnalysis.deleteMany({
          where: { conversationId: { in: conversationIds } }
        });
        
        // Resetar tempo da última mensagem, mantendo a conversa e seu estágio intactos
        await prisma.conversation.updateMany({
          where: { id: { in: conversationIds } },
          data: { lastMessageAt: null }
        });
      }
    }

    // Keep the connection row stable so conversations remain attached across QR reconnects.
    await prisma.whatsAppConnection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        instanceName: null,
        instanceToken: null,
        webhookSecret: null,
        qrCodeCreatedAt: null,
        isActive: false,
      }
    });

    revalidatePath('/settings');
    revalidatePath('/conversations');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao desconectar WhatsApp:", error?.message || error);
    return { error: "Falha ao desconectar. Tente novamente." };
  }
}
