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
    
    // 3. Busca conexão existente
    const existingConnection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId }
    });

    const data = {
      provider: 'EVOLUTION',
      instanceName: instanceName,
      instanceToken: result.hash,
      status: 'DISCONNECTED'
    };

    // 4. Salva ou atualiza no banco
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

    // 5. Configura o Webhook automaticamente
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
