'use server';

import type { AnalysisResponse } from '@/lib/ai/prompts';
import prisma from '@/lib/prisma';
import { evolution } from '@/lib/evolution';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { getCurrentWorkspace } from '@/lib/workspace';
import { revalidatePath } from 'next/cache';

export type DashboardData = {
  kpis: {
    activeConversations: number;
    hotLeads: number;
    pendingTasks: number;
    proposals: number;
  };
  recentAnalyses: Array<{
    contact: string;
    stage: string;
    time: string;
    risk: string;
  }>;
  urgentConversations: Array<{
    id: string;
    name: string;
    company: string;
    reason: string;
    temperature: 'hot' | 'warm' | 'cold';
  }>;
};

export type LeadData = {
  id: string;
  name: string;
  company: string;
  stage: string;
  stageKey: string;
  temperature: string;
  value: string;
  lastContact: string;
  origin: string;
  phone: string;
  email: string | null;
  notes: string | null;
  conversationId: string | null;
  monthlyRevenue: number | null;
  mainChallenges: string | null;
  productId: string | null;
  productName: string | null;
};

export type ProductData = {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  isActive: boolean;
};

export type PipelineStageData = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type TaskData = {
  id: string;
  title: string;
  type: string;
  contact: string;
  due: string;
  priority: string;
  status: string;
  contactId: string | null;
};

export type ConversationMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  type: string;
  text: string;
  mediaUrl?: string | null;
  time: string;
  timestamp: string;
  isEdited?: boolean;
  reactions?: any;
};

export type ConversationAnalysisData = AnalysisResponse & {
  id: string;
  createdAt: string;
};

export type ConversationData = {
  id: string;
  contactId: string;
  name: string;
  initials: string;
  company: string;
  stage: string;
  stageKey: string;
  time: string;
  msg: string;
  status: 'hot' | 'warm' | 'cold';
  unread: number;
  phone: string;
  origin: string;
  notes: string | null;
  isLead: boolean;
  messageCount: number;
  canReply: boolean;
  avatarUrl: string | null;
  messages: ConversationMessage[];
  latestAnalysis: ConversationAnalysisData | null;
};

export type PromptTemplateData = {
  id: string;
  name: string;
  slug: string;
  category: string;
  version: number;
  isActive: boolean;
  content: string;
  updatedAt: string;
};

export type WhatsAppConnectionSettings = {
  id: string | null;
  provider: string;
  instanceName: string | null;
  instanceToken: string | null;
  phoneNumberId: string;
  wabaId: string;
  hasAccessToken: boolean;
  status: string;
};

export type SettingsData = {
  whatsappConnectionStatus: string;
  whatsappLastSync: string;
  whatsappConnection: WhatsAppConnectionSettings;
  openAIStatus: string;
  inngestStatus: string;
  promptTemplatesCount: number;
  promptTemplates: PromptTemplateData[];
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return 'Sem data';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return 'Sem contato';
  }

  const now = new Date();
  const dayDelta = Math.floor((now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24));
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);

  if (dayDelta <= 0) {
    return `Hoje ${time}`;
  }

  if (dayDelta === 1) {
    return `Ontem ${time}`;
  }

  if (dayDelta < 7) {
    return `${new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(value)} ${time}`;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(value);
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function slugifyPromptName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function normalizeTemperature(value: string | null | undefined): 'hot' | 'warm' | 'cold' {
  if (value === 'HOT') return 'hot';
  if (value === 'WARM') return 'warm';
  return 'cold';
}

function normalizeStageLabel(stage: string | null | undefined) {
  const labels: Record<string, string> = {
    PRIMEIRO_CONTATO: 'Primeiro Contato',
    QUALIFICACAO: 'Qualificação',
    APRESENTACAO_PROPOSTA: 'Proposta',
    NEGOCIACAO: 'Negociação',
    OBJECAO: 'Objeção',
    FOLLOW_UP: 'Follow-up',
    FECHAMENTO: 'Fechamento',
    REATIVACAO: 'Reativação',
  };

  return stage ? labels[stage] ?? stage : '-';
}

function formatConversationMessage(content: string | null, transcript: string | null, type: string) {
  if (transcript) {
    return transcript;
  }

  if (content) {
    return content;
  }

  if (type === 'AUDIO') return 'Mensagem de áudio';
  if (type === 'IMAGE') return 'Imagem enviada';
  if (type === 'VIDEO') return 'Vídeo enviado';
  if (type === 'DOCUMENT') return 'Documento enviado';
  if (type === 'STICKER') return 'Figurinha';
  return 'Mensagem recebida';
}

function mapSuggestedRepliesToObject(
  replies: Array<{ type: string; content: string }>
): AnalysisResponse['suggestedReplies'] {
  return {
    direct: replies.find((reply) => reply.type === 'DIRECT')?.content || '',
    consultative: replies.find((reply) => reply.type === 'CONSULTATIVE')?.content || '',
    whatsappShort: replies.find((reply) => reply.type === 'WHATSAPP_SHORT')?.content || '',
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const workspace = await getCurrentWorkspace();
  const orgId = workspace.organizationId;

  const [activeConversations, hotLeads, pendingTasks, proposals] = await Promise.all([
    prisma.conversation.count({ where: { contact: { organizationId: orgId }, status: 'OPEN' } }),
    prisma.conversation.count({ where: { contact: { organizationId: orgId }, temperature: 'HOT' } }),
    prisma.task.count({ where: { user: { organizationId: orgId }, status: 'PENDING' } }),
    prisma.conversation.count({ where: { contact: { organizationId: orgId }, stage: 'APRESENTACAO_PROPOSTA' } }),
  ]);

  const recentAnalyses = await prisma.aIAnalysis.findMany({
    where: { conversation: { contact: { organizationId: orgId } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      conversation: {
        include: { contact: true },
      },
    },
  });

  const urgentConversations = await prisma.conversation.findMany({
    where: {
      contact: { organizationId: orgId },
      status: 'OPEN',
      temperature: 'HOT',
      lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    include: { contact: true },
    orderBy: { lastMessageAt: 'asc' },
    take: 5,
  });

  return {
    kpis: {
      activeConversations,
      hotLeads,
      pendingTasks,
      proposals,
    },
    recentAnalyses: recentAnalyses.map((analysis) => ({
      contact: analysis.conversation.contact.name,
      stage: normalizeStageLabel(analysis.stage),
      time: formatDateTime(analysis.createdAt),
      risk: analysis.riskLevel,
    })),
    urgentConversations: urgentConversations.map((conversation) => ({
      id: conversation.id,
      name: conversation.contact.name,
      company: conversation.contact.company || 'Sem empresa',
      reason: conversation.lastMessageAt
        ? `Sem retorno há ${formatTimeLabel(conversation.lastMessageAt).replace('Hoje ', '').replace('Ontem ', '')}`
        : 'Sem retorno recente',
      temperature: normalizeTemperature(conversation.temperature),
    })),
  };
}

export async function getLeads(): Promise<LeadData[]> {
  const workspace = await getCurrentWorkspace();
  const orgId = workspace.organizationId;

  const leads = await prisma.contact.findMany({
    where: { organizationId: orgId, isLead: true },
    include: {
      product: true,
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return leads.map((lead) => {
    const latestConversation = lead.conversations[0];

    return {
      id: lead.id,
      name: lead.name,
      company: lead.company || 'Sem empresa',
      stage: normalizeStageLabel(latestConversation?.stage),
      stageKey: latestConversation?.stage || 'PRIMEIRO_CONTATO',
      temperature: latestConversation?.temperature || 'COLD',
      value: formatCurrency(lead.potentialValue),
      lastContact: formatTimeLabel(latestConversation?.lastMessageAt || lead.updatedAt),
      origin: lead.origin || 'Não informado',
      phone: lead.phone,
      email: lead.email,
      notes: lead.notes || null,
      conversationId: latestConversation?.id || null,
      monthlyRevenue: lead.monthlyRevenue,
      mainChallenges: lead.mainChallenges,
      productId: lead.productId,
      productName: lead.product?.name || null,
    };
  });
}

export async function updateConversationStage(conversationId: string, stage: string) {
  const workspace = await getCurrentWorkspace();

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      contact: { organizationId: workspace.organizationId },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { stage },
  });

  revalidatePath('/leads');
  revalidatePath('/dashboard');
  revalidatePath('/conversations');

  return updated;
}

export async function getTasks(): Promise<TaskData[]> {
  const workspace = await getCurrentWorkspace();
  const orgId = workspace.organizationId;

  const tasks = await prisma.task.findMany({
    where: { user: { organizationId: orgId } },
    include: { contact: true },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    type: task.type,
    contact: task.contact?.name || 'Sem contato',
    due: task.dueAt ? formatDateTime(task.dueAt) : 'Sem data',
    priority: task.priority,
    status: task.status,
    contactId: task.contactId,
  }));
}

export async function createTask(input: {
  title: string;
  type?: string;
  priority?: string;
  dueAt?: string;
  contactId?: string | null;
  description?: string;
}) {
  const workspace = await getCurrentWorkspace();

  if (!input.title.trim()) {
    throw new Error('Task title is required');
  }

  if (input.contactId) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: input.contactId,
        organizationId: workspace.organizationId,
      },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }
  }

  const created = await prisma.task.create({
    data: {
      userId: workspace.id,
      contactId: input.contactId || null,
      title: input.title.trim(),
      description: input.description || null,
      type: input.type || 'FOLLOW_UP',
      priority: input.priority || 'MEDIUM',
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    },
    include: { contact: true },
  });

  revalidatePath('/tasks');
  revalidatePath('/dashboard');

  return {
    id: created.id,
    title: created.title,
    type: created.type,
    contact: created.contact?.name || 'Sem contato',
    due: created.dueAt ? formatDateTime(created.dueAt) : 'Sem data',
    priority: created.priority,
    status: created.status,
    contactId: created.contactId,
  } satisfies TaskData;
}

export async function toggleTaskStatus(taskId: string, currentStatus: string) {
  const workspace = await getCurrentWorkspace();
  const nextStatus = currentStatus === 'DONE' ? 'PENDING' : 'DONE';

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      user: { organizationId: workspace.organizationId },
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === 'DONE' ? new Date() : null,
    },
  });

  revalidatePath('/tasks');
  revalidatePath('/dashboard');

  return {
    id: updated.id,
    status: updated.status,
    completedAt: updated.completedAt?.toISOString() || null,
  };
}

export async function getConversations(): Promise<ConversationData[]> {
  const workspace = await getCurrentWorkspace();
  const orgId = workspace.organizationId;

  const whatsappConnection = await prisma.whatsAppConnection.findFirst({
    where: {
      organizationId: orgId,
      status: 'CONNECTED',
    },
  });

  const conversations = await prisma.conversation.findMany({
    where: { contact: { organizationId: orgId } },
    include: {
      contact: true,
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          suggestedReplies: true,
        },
      },
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 50,
        include: {
          transcript: true,
          media: true,
        },
      },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
  });

  return conversations.map((conversation) => {
    const lastMessage = conversation.messages[0]; // Messages are fetched DESC, so [0] is the newest
    const preview = lastMessage
      ? formatConversationMessage(
          lastMessage.content,
          lastMessage.transcript?.text || null,
          lastMessage.type,
        )
      : 'Sem mensagens ainda';

    const time = conversation.lastMessageAt || conversation.updatedAt;

    return {
      id: conversation.id,
      contactId: conversation.contactId,
      name: conversation.contact.name,
      initials: getInitials(conversation.contact.name),
      company: conversation.contact.company || 'Sem empresa',
      stage: normalizeStageLabel(conversation.stage),
      stageKey: conversation.stage,
      time: formatTimeLabel(time),
      msg: preview,
      status: normalizeTemperature(conversation.temperature),
      unread: 0,
      phone: conversation.contact.phone,
      origin: conversation.contact.origin || 'Não informado',
      notes: conversation.contact.notes || null,
      isLead: conversation.contact.isLead,
      messageCount: conversation.messages.length,
      canReply: Boolean(
        (whatsappConnection?.provider === 'META' && whatsappConnection?.accessToken && whatsappConnection.phoneNumberId) ||
        (whatsappConnection?.provider === 'EVOLUTION' && whatsappConnection?.instanceName && whatsappConnection?.status === 'CONNECTED')
      ),
      avatarUrl: conversation.contact.avatarUrl,
      messages: conversation.messages.reverse().map((message) => ({
        id: message.id,
        direction: message.direction === 'OUTBOUND' ? 'outbound' : 'inbound',
        type: message.type,
        text: formatConversationMessage(
          message.content,
          message.transcript?.text || null,
          message.type,
        ),
        mediaUrl: message.mediaUrl,
        time: new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(message.timestamp),
        timestamp: message.timestamp.toISOString(),
        isEdited: message.isEdited,
        reactions: message.reactions,
      })),
      latestAnalysis: conversation.analyses[0]
        ? {
            id: conversation.analyses[0].id,
            createdAt: conversation.analyses[0].createdAt.toISOString(),
            summary: conversation.analyses[0].summary,
            stage: conversation.analyses[0].stage as AnalysisResponse['stage'],
            leadClassification: conversation.analyses[0].leadClassification as AnalysisResponse['leadClassification'],
            riskLevel: conversation.analyses[0].riskLevel as AnalysisResponse['riskLevel'],
            urgency: conversation.analyses[0].urgency as AnalysisResponse['urgency'],
            painPoints: Array.isArray(conversation.analyses[0].painPoints) ? conversation.analyses[0].painPoints as string[] : [],
            explicitObjections: Array.isArray(conversation.analyses[0].explicitObjections) ? conversation.analyses[0].explicitObjections as string[] : [],
            implicitObjections: Array.isArray(conversation.analyses[0].implicitObjections) ? conversation.analyses[0].implicitObjections as string[] : [],
            buyingSignals: Array.isArray(conversation.analyses[0].buyingSignals) ? conversation.analyses[0].buyingSignals as string[] : [],
            recommendedPosture: conversation.analyses[0].recommendedPosture,
            whatToAvoid: conversation.analyses[0].whatToAvoid,
            nextConcreteStep: conversation.analyses[0].nextConcreteStep,
            suggestedReplies: mapSuggestedRepliesToObject(conversation.analyses[0].suggestedReplies),
          }
        : null,
    };
  });
}

export async function getSettingsData(): Promise<SettingsData> {
  try {
    const workspace = await getCurrentWorkspace();
    const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';

    const [whatsappConnection, promptTemplates] = await Promise.all([
      prisma.whatsAppConnection.findFirst({
        where: { organizationId: workspace.organizationId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.promptTemplate.findMany({
        where: { organizationId: workspace.organizationId },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      }),
    ]);

    return {
      whatsappConnectionStatus: whatsappConnection?.status || 'DISCONNECTED',
      whatsappLastSync: whatsappConnection?.lastSyncAt ? formatDateTime(whatsappConnection.lastSyncAt) : 'Nunca',
      whatsappConnection: {
        id: whatsappConnection?.id || null,
        provider: whatsappConnection?.provider || 'META',
        instanceName: whatsappConnection?.instanceName || null,
        instanceToken: whatsappConnection?.instanceToken || null,
        phoneNumberId: whatsappConnection?.phoneNumberId || '',
        wabaId: whatsappConnection?.wabaId || '',
        hasAccessToken: Boolean(whatsappConnection?.accessToken || envWhatsAppToken),
        status: whatsappConnection?.status || 'DISCONNECTED',
      },
      openAIStatus: process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key' ? 'Configurado' : 'Pendente',
      inngestStatus: process.env.NODE_ENV === 'development' ? 'Ativo (Dev)' : process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY ? 'Ativo' : 'Pendente',
      promptTemplatesCount: promptTemplates.length,
      promptTemplates: promptTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        slug: template.slug,
        category: template.category,
        version: template.version,
        isActive: template.isActive,
        content: template.content,
        updatedAt: template.updatedAt.toISOString(),
      })),
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error("ERRO CRÍTICO no getSettingsData:", errorMsg);
    
    return {
      whatsappConnectionStatus: 'ERROR',
      whatsappLastSync: '-',
      whatsappConnection: {
        id: null,
        provider: 'META',
        instanceName: null,
        instanceToken: null,
        phoneNumberId: '',
        wabaId: '',
        hasAccessToken: false,
        status: 'ERROR',
      },
      openAIStatus: 'Erro no Banco',
      inngestStatus: errorMsg.includes('Prisma') ? 'Erro de Conexão Prisma' : 'Erro no Banco',
      promptTemplatesCount: 0,
      promptTemplates: [],
      // Adicionando um campo extra (mesmo que não esteja no tipo original, o JS aceita)
      errorMessage: errorMsg
    } as any;
  }
}

export async function sendConversationMessage(conversationId: string, content: string) {
  const workspace = await getCurrentWorkspace();
  const trimmedContent = content.trim();
  const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';

  if (!trimmedContent) {
    throw new Error('Message content is required');
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      contact: { organizationId: workspace.organizationId },
    },
    include: {
      contact: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const connection = await prisma.whatsAppConnection.findFirst({
    where: {
      organizationId: workspace.organizationId,
      status: 'CONNECTED',
    },
  });

  const isEvolution = connection?.provider === 'EVOLUTION';
  const accessToken = isEvolution ? connection?.instanceToken : (connection?.accessToken || envWhatsAppToken);

  if (!accessToken || (!isEvolution && !connection?.phoneNumberId)) {
    throw new Error('WhatsApp connection is not configured for outbound messages');
  }

  try {
    let response: any;
    let waMessageId: string | null = null;

    if (isEvolution && connection?.instanceName) {
      // Evolution API Logic
      const { decryptToken } = await import('@/lib/encryption');
      const decryptedToken = decryptToken(accessToken);
      
      const result = await evolution.sendText(
        connection.instanceName,
        decryptedToken,
        conversation.contact.phone,
        trimmedContent
      );
      
      response = result;
      waMessageId = result.key?.id || result.message?.key?.id || null;
    } else if (connection?.phoneNumberId) {
      // Meta API Logic
      const result = await sendWhatsAppMessage(accessToken, {
        phoneNumberId: connection.phoneNumberId,
        to: conversation.contact.phone,
        type: 'text',
        text: { body: trimmedContent },
      });
      
      response = result;
      waMessageId = result?.messages?.[0]?.id || null;
    } else {
      throw new Error('Unsupported WhatsApp provider or missing configuration');
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: trimmedContent,
        waMessageId,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.timestamp,
      },
    });

    await prisma.integrationLog.create({
      data: {
        connectionId: connection.id,
        event: 'OUTBOUND_SEND',
        direction: 'OUTBOUND',
        payload: response,
        statusCode: 200,
      },
    });

    revalidatePath('/conversations');
    revalidatePath('/dashboard');

    return {
      id: message.id,
      direction: 'outbound' as const,
      type: 'TEXT',
      text: trimmedContent,
      time: new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(message.timestamp),
      timestamp: message.timestamp.toISOString(),
    };
  } catch (error) {
    await prisma.integrationLog.create({
      data: {
        connectionId: connection.id,
        event: 'OUTBOUND_ERROR',
        direction: 'OUTBOUND',
        errorMsg: error instanceof Error ? error.message : 'Unknown outbound error',
      },
    });

    throw error;
  }
}

export async function sendMediaMessage(input: {
  conversationId: string;
  base64: string;
  mediatype: string;
  mimetype: string;
  fileName?: string;
}) {
  const workspace = await getCurrentWorkspace();
  const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: input.conversationId,
      contact: { organizationId: workspace.organizationId },
    },
    include: { contact: true },
  });

  if (!conversation) throw new Error('Conversation not found');

  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, status: 'CONNECTED' },
  });

  const isEvolution = connection?.provider === 'EVOLUTION';
  const accessToken = isEvolution ? connection?.instanceToken : (connection?.accessToken || envWhatsAppToken);

  if (!accessToken || !isEvolution || !connection?.instanceName) {
    throw new Error('Media sending is currently only supported via Evolution API');
  }

  try {
    const { decryptToken } = await import('@/lib/encryption');
    const decryptedToken = decryptToken(accessToken);
    
    // Extract raw base64 if it has the data URI prefix
    const rawBase64 = input.base64.includes('base64,') 
      ? input.base64.split('base64,')[1] 
      : input.base64;

    const result = await evolution.sendMedia(
      connection.instanceName,
      decryptedToken,
      conversation.contact.phone,
      rawBase64,
      input.mediatype,
      input.mimetype,
      "",
      input.fileName
    );
    
    const waMessageId = result.key?.id || result.message?.key?.id || null;

    // Prisma map type: image -> IMAGE, document -> DOCUMENT, audio -> AUDIO
    const dbType = input.mediatype.toUpperCase();
    const mediaUrl = `data:${input.mimetype};base64,${rawBase64}`;

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: dbType,
        content: `Mídia enviada (${input.mediatype})`,
        mediaUrl: mediaUrl,
        waMessageId,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.timestamp },
    });

    await prisma.integrationLog.create({
      data: {
        connectionId: connection.id,
        event: 'OUTBOUND_MEDIA_SEND',
        direction: 'OUTBOUND',
        payload: result,
        statusCode: 200,
      },
    });

    revalidatePath('/conversations');
    revalidatePath('/dashboard');

    return {
      id: message.id,
      direction: 'outbound' as const,
      type: dbType,
      text: `Mídia enviada (${input.mediatype})`,
      mediaUrl: mediaUrl,
      time: new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', minute: '2-digit',
      }).format(message.timestamp),
      timestamp: message.timestamp.toISOString(),
    };
  } catch (error) {
    await prisma.integrationLog.create({
      data: {
        connectionId: connection.id,
        event: 'OUTBOUND_MEDIA_ERROR',
        direction: 'OUTBOUND',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

export async function saveWhatsAppConnectionSettings(input: {
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
}) {
  const workspace = await getCurrentWorkspace();
  const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const phoneNumberId = input.phoneNumberId?.trim() || '';
  const wabaId = input.wabaId?.trim() || '';
  const providedToken = input.accessToken?.trim() || '';

  const existingConnection = await prisma.whatsAppConnection.findFirst({
    where: {
      organizationId: workspace.organizationId,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const nextToken = providedToken || existingConnection?.accessToken || envWhatsAppToken || null;
  const nextStatus = phoneNumberId && nextToken ? 'CONNECTED' : 'DISCONNECTED';

  const savedConnection = existingConnection
    ? await prisma.whatsAppConnection.update({
        where: { id: existingConnection.id },
        data: {
          phoneNumberId: phoneNumberId || null,
          wabaId: wabaId || null,
          accessToken: nextToken,
          status: nextStatus,
        },
      })
    : await prisma.whatsAppConnection.create({
        data: {
          organizationId: workspace.organizationId,
          phoneNumberId: phoneNumberId || null,
          wabaId: wabaId || null,
          accessToken: nextToken,
          status: nextStatus,
        },
      });

  revalidatePath('/settings');
  revalidatePath('/conversations');

  return {
    id: savedConnection.id,
    provider: savedConnection.provider,
    instanceName: savedConnection.instanceName,
    instanceToken: savedConnection.instanceToken,
    phoneNumberId: savedConnection.phoneNumberId || '',
    wabaId: savedConnection.wabaId || '',
    hasAccessToken: Boolean(savedConnection.accessToken),
    status: savedConnection.status,
  } satisfies WhatsAppConnectionSettings;
}

export async function savePromptTemplateVersion(input: {
  name: string;
  slug?: string;
  category: string;
  content: string;
}) {
  const workspace = await getCurrentWorkspace();
  const name = input.name.trim();
  const content = input.content.trim();
  const slug = (input.slug?.trim() || slugifyPromptName(name) || 'template').slice(0, 50);

  if (!name || !content) {
    throw new Error('Prompt name and content are required');
  }

  const existingVersions = await prisma.promptTemplate.findMany({
    where: {
      organizationId: workspace.organizationId,
      slug,
    },
    orderBy: { version: 'desc' },
  });

  const nextVersion = (existingVersions[0]?.version || 0) + 1;

  await prisma.promptTemplate.updateMany({
    where: {
      organizationId: workspace.organizationId,
      slug,
    },
    data: { isActive: false },
  });

  const created = await prisma.promptTemplate.create({
    data: {
      organizationId: workspace.organizationId,
      name,
      slug,
      category: input.category,
      content,
      version: nextVersion,
      isActive: true,
    },
  });

  revalidatePath('/settings');

  return {
    id: created.id,
    name: created.name,
    slug: created.slug,
    category: created.category,
    version: created.version,
    isActive: created.isActive,
    content: created.content,
    updatedAt: created.updatedAt.toISOString(),
  } satisfies PromptTemplateData;
}

export async function deletePromptTemplate(templateId: string) {
  const workspace = await getCurrentWorkspace();
  
  const template = await prisma.promptTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: workspace.organizationId,
    },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  await prisma.promptTemplate.delete({
    where: { id: template.id },
  });

  if (template.isActive) {
    const latest = await prisma.promptTemplate.findFirst({
      where: {
        organizationId: workspace.organizationId,
        slug: template.slug,
      },
      orderBy: { version: 'desc' },
    });

    if (latest) {
      await prisma.promptTemplate.update({
        where: { id: latest.id },
        data: { isActive: true },
      });
    }
  }

  revalidatePath('/settings');
}

export async function setActivePromptTemplate(templateId: string) {
  const workspace = await getCurrentWorkspace();

  const template = await prisma.promptTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: workspace.organizationId,
    },
  });

  if (!template) {
    throw new Error('Prompt template not found');
  }

  await prisma.promptTemplate.updateMany({
    where: {
      organizationId: workspace.organizationId,
      slug: template.slug,
    },
    data: {
      isActive: false,
    },
  });

  const updated = await prisma.promptTemplate.update({
    where: { id: template.id },
    data: { isActive: true },
  });

  revalidatePath('/settings');

  return updated.id;
}

export async function saveConversationAnalysis(input: {
  conversationId: string;
  analysis: {
    summary: string;
    stage: string;
    leadClassification: string;
    urgency: string;
    painPoints: string[];
    explicitObjections: string[];
    implicitObjections: string[];
    buyingSignals: string[];
    riskLevel: string;
    recommendedPosture: string;
    whatToAvoid: string;
    nextConcreteStep: string;
    suggestedReplies: {
      direct: string;
      consultative: string;
      whatsappShort: string;
    };
  };
}) {
  const workspace = await getCurrentWorkspace();

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: input.conversationId,
      contact: { organizationId: workspace.organizationId },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const created = await prisma.aIAnalysis.create({
    data: {
      conversationId: conversation.id,
      userId: workspace.id,
      summary: input.analysis.summary,
      stage: input.analysis.stage,
      leadClassification: input.analysis.leadClassification,
      urgency: input.analysis.urgency,
      riskLevel: input.analysis.riskLevel,
      painPoints: input.analysis.painPoints,
      explicitObjections: input.analysis.explicitObjections,
      implicitObjections: input.analysis.implicitObjections,
      buyingSignals: input.analysis.buyingSignals,
      recommendedPosture: input.analysis.recommendedPosture,
      whatToAvoid: input.analysis.whatToAvoid,
      nextConcreteStep: input.analysis.nextConcreteStep,
    },
  });

  await prisma.suggestedReply.createMany({
    data: [
      {
        analysisId: created.id,
        type: 'DIRECT',
        content: input.analysis.suggestedReplies.direct,
      },
      {
        analysisId: created.id,
        type: 'CONSULTATIVE',
        content: input.analysis.suggestedReplies.consultative,
      },
      {
        analysisId: created.id,
        type: 'WHATSAPP_SHORT',
        content: input.analysis.suggestedReplies.whatsappShort,
      },
    ],
  });

  revalidatePath('/dashboard');
  revalidatePath('/conversations');

  return created;
}

export async function promoteToLead(contactId: string) {
  const workspace = await getCurrentWorkspace();

  const contact = await prisma.contact.update({
    where: { 
      id: contactId,
      organizationId: workspace.organizationId 
    },
    data: { isLead: true }
  });

  revalidatePath("/conversations");
  revalidatePath("/leads");
  
  return contact;
}

export async function updateContactNotes(contactId: string, notes: string) {
  const workspace = await getCurrentWorkspace();
  const contact = await prisma.contact.update({
    where: { 
      id: contactId,
      organizationId: workspace.organizationId 
    },
    data: { notes }
  });
  revalidatePath("/conversations");
  return contact;
}

export async function updateAnalysis(analysisId: string, data: Partial<AnalysisResponse>) {
  const workspace = await getCurrentWorkspace();
  
  // Verify ownership via conversation join
  const analysis = await prisma.aIAnalysis.findFirst({
    where: {
      id: analysisId,
      conversation: { contact: { organizationId: workspace.organizationId } }
    }
  });

  if (!analysis) throw new Error("Analysis not found or access denied");

  const updated = await prisma.aIAnalysis.update({
    where: { id: analysisId },
    data: {
      summary: data.summary,
      nextConcreteStep: data.nextConcreteStep,
      recommendedPosture: data.recommendedPosture,
      whatToAvoid: data.whatToAvoid,
    }
  });

  revalidatePath("/conversations");
  return updated;
}

// ============================================
// MESSAGE MANAGEMENT ACTIONS
// ============================================

export async function deleteOutboundMessage(messageId: string, conversationId: string) {
  const workspace = await getCurrentWorkspace();
  
  const message = await prisma.message.findFirst({
    where: { id: messageId, direction: 'OUTBOUND', conversation: { contact: { organizationId: workspace.organizationId } } },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) throw new Error("Message not found");

  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, provider: 'EVOLUTION', status: 'CONNECTED' },
  });
  
  if (connection?.instanceName && connection.instanceToken && message.waMessageId) {
    try {
      const { decryptToken } = await import('@/lib/encryption');
      const token = decryptToken(connection.instanceToken);
      await evolution.deleteMessage(connection.instanceName, token, message.conversation.contact.phone, message.waMessageId);
    } catch (e) {
      console.warn('Failed to delete on WhatsApp:', e);
    }
  }

  await prisma.message.delete({ where: { id: messageId } });
  revalidatePath('/conversations');
  return { success: true };
}

export async function editOutboundMessage(messageId: string, newText: string) {
  const workspace = await getCurrentWorkspace();
  
  const message = await prisma.message.findFirst({
    where: { id: messageId, direction: 'OUTBOUND', conversation: { contact: { organizationId: workspace.organizationId } } },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) throw new Error("Message not found");

  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, provider: 'EVOLUTION', status: 'CONNECTED' },
  });

  if (connection?.instanceName && connection.instanceToken && message.waMessageId) {
    try {
      const { decryptToken } = await import('@/lib/encryption');
      const token = decryptToken(connection.instanceToken);
      await evolution.editMessage(connection.instanceName, token, message.conversation.contact.phone, message.waMessageId, newText);
    } catch (e) {
      console.warn('Failed to edit on WhatsApp:', e);
    }
  }

  const updated = await prisma.message.update({ where: { id: messageId }, data: { content: newText } });
  revalidatePath('/conversations');
  return updated;
}

export async function sendMessageReaction(conversationId: string, messageId: string, emoji: string) {
  const workspace = await getCurrentWorkspace();

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversation: { contact: { organizationId: workspace.organizationId } } },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) throw new Error("Message not found");

  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, provider: 'EVOLUTION', status: 'CONNECTED' },
  });

  if (connection?.instanceName && connection.instanceToken && message.waMessageId) {
    try {
      const { decryptToken } = await import('@/lib/encryption');
      const token = decryptToken(connection.instanceToken);
      await evolution.sendReaction(
        connection.instanceName,
        token,
        message.conversation.contact.phone,
        message.waMessageId,
        emoji,
        message.direction === 'OUTBOUND'
      );
    } catch (e) {
      console.warn('Failed to react on WhatsApp:', e);
    }
  }

  return { success: true };
}

// ============================================
// WHATSAPP PROFILE MANAGEMENT
// ============================================

export async function getWhatsAppProfile() {
  const workspace = await getCurrentWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, provider: 'EVOLUTION', status: 'CONNECTED' },
  });

  if (!connection?.instanceName || !connection.instanceToken) {
    return null;
  }

  try {
    const { decryptToken } = await import('@/lib/encryption');
    const token = decryptToken(connection.instanceToken);
    const profile = await evolution.fetchProfile(connection.instanceName, token);
    return profile;
  } catch (e) {
    console.warn('Failed to fetch WhatsApp profile:', e);
    return null;
  }
}

export async function updateWhatsAppProfile(data: { name?: string; status?: string; pictureBase64?: string }) {
  const workspace = await getCurrentWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, provider: 'EVOLUTION', status: 'CONNECTED' },
  });

  if (!connection?.instanceName || !connection.instanceToken) {
    throw new Error("WhatsApp not connected");
  }

  const { decryptToken } = await import('@/lib/encryption');
  const token = decryptToken(connection.instanceToken);
  const results: Record<string, unknown> = {};

  if (data.name) {
    results.name = await evolution.updateProfileName(connection.instanceName, token, data.name);
  }
  if (data.status) {
    results.status = await evolution.updateProfileStatus(connection.instanceName, token, data.status);
  }
  if (data.pictureBase64) {
    results.picture = await evolution.updateProfilePicture(connection.instanceName, token, data.pictureBase64);
  }

  return results;
}

export async function getContactProfile(contactPhone: string) {
  const workspace = await getCurrentWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, provider: 'EVOLUTION', status: 'CONNECTED' },
  });

  if (!connection?.instanceName || !connection.instanceToken) return null;

  try {
    const { decryptToken } = await import('@/lib/encryption');
    const token = decryptToken(connection.instanceToken);
    const [profile, avatar] = await Promise.all([
      evolution.fetchProfile(connection.instanceName, token, contactPhone),
      evolution.fetchProfilePictureUrl(connection.instanceName, token, contactPhone),
    ]);
    return { ...profile, avatarUrl: avatar };
  } catch (e) {
    console.warn('Failed to fetch contact profile:', e);
    return null;
  }
}

export async function getPipelineStages(): Promise<PipelineStageData[]> {
  const workspace = await getCurrentWorkspace();
  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId: workspace.organizationId },
    orderBy: { order: 'asc' },
  });

  return stages;
}

export async function getProducts(): Promise<ProductData[]> {
  const workspace = await getCurrentWorkspace();
  const products = await prisma.product.findMany({
    where: { organizationId: workspace.organizationId, isActive: true },
    orderBy: { name: 'asc' },
  });

  return products;
}

export async function updateContactProfile(contactId: string, data: {
  name?: string;
  email?: string;
  company?: string;
  monthlyRevenue?: number;
  mainChallenges?: string;
  productId?: string;
  notes?: string;
}) {
  const workspace = await getCurrentWorkspace();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: workspace.organizationId },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data,
  });

  revalidatePath('/leads');
  revalidatePath('/conversations');
  return updated;
}

export async function suggestChallengesFromAI(contactId: string) {
  const workspace = await getCurrentWorkspace();
  
  // Get latest analysis for this contact
  const analysis = await prisma.aIAnalysis.findFirst({
    where: { 
      conversation: { 
        contactId, 
        contact: { organizationId: workspace.organizationId }
      } 
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!analysis) {
    return null;
  }

  // Combine pain points and implicit objections to form challenges
  const painPoints = Array.isArray(analysis.painPoints) ? analysis.painPoints : [];
  const implicitObjections = Array.isArray(analysis.implicitObjections) ? analysis.implicitObjections : [];
  
  const challenges = [...painPoints, ...implicitObjections].join('\n');
  return challenges || "Nenhum desafio evidente encontrado na análise.";
}
