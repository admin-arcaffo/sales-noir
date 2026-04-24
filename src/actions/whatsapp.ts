'use server';

import { evolution } from '@/lib/evolution';
import prisma from '@/lib/prisma';
import { getCurrentWorkspace } from '@/lib/workspace';
import { revalidatePath } from 'next/cache';

export async function createWhatsAppInstance() {
  try {
    const workspace = await getCurrentWorkspace();
    const orgId = workspace.organizationId;

    if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
      console.error("ERRO: Variáveis EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no Vercel.");
      return { error: "Configuração da API de WhatsApp pendente no servidor." };
    }

    const instanceName = `noir-${orgId.slice(0, 8)}`;
    console.log(`Iniciando criação de instância: ${instanceName}`);

    // 2. Cria a instância na Evolution API
    const result = await evolution.createInstance(instanceName);
    console.log("Instância criada na Evolution com sucesso");
    
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (appUrl) {
      const webhookUrl = `${appUrl.startsWith('http') ? '' : 'https://'}${appUrl}/api/webhook/evolution`;
      console.log(`Configurando Webhook: ${webhookUrl}`);
      await evolution.setWebhook(instanceName, result.hash, webhookUrl);
    }

    revalidatePath('/settings');
    return { success: true, instanceName, instanceToken: result.hash };
  } catch (error: any) {
    console.error("Falha detalhada ao criar instância WhatsApp:", error?.message || error);
    return { error: "Falha ao conectar com o servidor de WhatsApp. Verifique as configurações." };
  }
}

export async function getWhatsAppQrCode(instanceName: string, instanceToken: string) {
  try {
    if (!instanceName || !instanceToken) {
      return { error: "Dados da instância inválidos." };
    }
    const qrData = await evolution.getQrCode(instanceName, instanceToken);
    return qrData;
  } catch (error: any) {
    console.error("Erro ao buscar QR Code:", error?.message || error);
    return { error: "Não foi possível carregar o QR Code. Tente novamente." };
  }
}

export async function getWhatsAppStatus() {
  const workspace = await getCurrentWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId }
  });

  return connection;
}
