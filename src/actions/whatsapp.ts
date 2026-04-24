'use server';

import { evolution } from '@/lib/evolution';
import prisma from '@/lib/prisma';
import { getCurrentWorkspace } from '@/lib/workspace';
import { revalidatePath } from 'next/cache';

export async function createWhatsAppInstance() {
  const workspace = await getCurrentWorkspace();
  const orgId = workspace.organizationId;

  // 1. Gera um nome de instância amigável e único
  const instanceName = `noir-${orgId.slice(0, 8)}`;

  try {
    // 2. Cria a instância na Evolution API
    const result = await evolution.createInstance(instanceName);
    
    // 3. Salva ou atualiza a conexão no banco
    const connection = await prisma.whatsAppConnection.upsert({
      where: { organizationId: orgId },
      update: {
        provider: 'EVOLUTION',
        instanceName: instanceName,
        instanceToken: result.hash, // O token gerado pela Evolution
        status: 'DISCONNECTED'
      },
      create: {
        organizationId: orgId,
        provider: 'EVOLUTION',
        instanceName: instanceName,
        instanceToken: result.hash,
        status: 'DISCONNECTED'
      }
    });

    // 4. Configura o Webhook automaticamente
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/evolution`;
    await evolution.setWebhook(instanceName, result.hash, webhookUrl);

    revalidatePath('/settings');
    return { success: true, instanceName, instanceToken: result.hash };
  } catch (error) {
    console.error("Failed to create WhatsApp instance:", error);
    throw error;
  }
}

export async function getWhatsAppQrCode(instanceName: string, instanceToken: string) {
  try {
    const qrData = await evolution.getQrCode(instanceName, instanceToken);
    return qrData;
  } catch (error) {
    console.error("Failed to fetch QR Code:", error);
    throw error;
  }
}

export async function getWhatsAppStatus() {
  const workspace = await getCurrentWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId }
  });

  return connection;
}
