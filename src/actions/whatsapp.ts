'use server';

import { evolution } from '@/lib/evolution';
import prisma from '@/lib/prisma';
import { getCurrentWorkspace } from '@/lib/workspace';
import { revalidatePath } from 'next/cache';
import { encryptToken, generateWebhookSecret } from '@/lib/encryption';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ATTEMPTS_PER_DAY = 5;

async function checkRateLimit(orgId: string): Promise<{ allowed: boolean; error?: string }> {
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId }
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
    const workspace = await getCurrentWorkspace();
    const orgId = workspace.organizationId;

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(orgId);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for org ${orgId}: ${rateLimitCheck.error}`);
      return { error: rateLimitCheck.error || "Too many connection attempts. Please try again later." };
    }

    if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
      console.error("ERRO: Variáveis EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no Vercel.");
      return { error: "Configuração da API de WhatsApp pendente no servidor." };
    }

    const instanceName = `noir-${orgId.slice(0, 8)}`;
    console.log(`Iniciando criação de instância: ${instanceName}`);

    // Create instance on Evolution API
    const result = await evolution.createInstance(instanceName);
    console.log("Instância criada na Evolution com sucesso");
    
    // Encrypt the instance token before storage
    const encryptedToken = encryptToken(result.hash);
    const webhookSecret = generateWebhookSecret();
    
    // Look for existing connection
    const existingConnection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId }
    });

    const data = {
      provider: 'EVOLUTION',
      instanceName: instanceName,
      instanceToken: encryptedToken, // Store encrypted
      webhookSecret: webhookSecret, // For HMAC verification
      status: 'DISCONNECTED',
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
          organizationId: orgId
        }
      });
    }

    // Configure webhook automatically
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (appUrl) {
      const webhookUrl = `${appUrl.startsWith('http') ? '' : 'https://'}${appUrl}/api/webhook/evolution`;
      console.log(`Configurando Webhook: ${webhookUrl}`);
      await evolution.setWebhook(instanceName, result.hash, webhookUrl);
    }

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

    const workspace = await getCurrentWorkspace();
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { 
        organizationId: workspace.organizationId,
        instanceName: instanceName
      }
    });

    if (!connection || !connection.instanceToken) {
      return { error: "Instância não encontrada." };
    }

    // Check if QR code has expired (valid for ~120 seconds)
    const qrCreatedAt = connection.qrCodeCreatedAt?.getTime() || 0;
    const now = Date.now();
    const qrAge = now - qrCreatedAt;
    const QR_EXPIRY_MS = 120 * 1000; // 120 seconds

    if (qrAge > QR_EXPIRY_MS) {
      return { error: "QR Code expirado. Gere um novo.", expired: true };
    }

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
    const workspace = await getCurrentWorkspace();
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: workspace.organizationId }
    });

    if (!connection) {
      return { status: 'DISCONNECTED' };
    }

    // Don't return encrypted token to client
    const { instanceToken, accessToken, ...safeConnection } = connection;
    return safeConnection;
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    return { status: 'ERROR', error: 'Failed to get status' };
  }
}

export async function disconnectWhatsApp() {
  try {
    const workspace = await getCurrentWorkspace();
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: workspace.organizationId }
    });

    if (!connection) {
      return { error: "Conexão não encontrada." };
    }

    // Decrypt token to disconnect from Evolution API
    const { decryptToken } = await import('@/lib/encryption');
    let decryptedToken: string;
    try {
      decryptedToken = decryptToken(connection.instanceToken || '');
    } catch (error) {
      console.error('Failed to decrypt token:', error);
      return { error: "Erro ao descriptografar credenciais." };
    }

    // Call Evolution API to disconnect
    if (connection.instanceName && decryptedToken) {
      try {
        await evolution.disconnectInstance(connection.instanceName, decryptedToken);
      } catch (error) {
        console.error('Evolution API disconnect error:', error);
        // Continue with local cleanup even if API call fails
      }
    }

    // Update connection status locally
    await prisma.whatsAppConnection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        instanceToken: null,
        webhookSecret: null,
        lastConnectionAttemptAt: new Date()
      }
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao desconectar WhatsApp:", error?.message || error);
    return { error: "Falha ao desconectar. Tente novamente." };
  }
}
