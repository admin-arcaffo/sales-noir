'use server';

import type { AnalysisResponse } from '@/lib/ai/prompts';
import prisma from '@/lib/prisma';
import { evolution, resolveEvolutionMediaPayload } from '@/lib/evolution';
import { ensureContactIdentities, getPhoneIdentityValues, previewContactMerge, resolveOrCreateContact, type ContactMergeConflict } from '@/lib/contact-resolver';
import { sendWhatsAppMessage, uploadWhatsAppMedia } from '@/lib/whatsapp';
import { getCurrentWorkspace, ensurePaidWorkspace } from '@/lib/workspace';
import { getBrazilianPhoneVariations, getOutboundWhatsAppNumber, getOutboundWhatsAppNumberCandidates } from '@/lib/phone';
import { resolveOpenConversation } from '@/lib/conversation-resolver';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  getMediaProxyUrl,
  normalizeBase64Media,
  readStoredMediaBase64,
  saveMessageMediaFromBase64,
} from '@/lib/media-storage';

export type DashboardData = {
  kpis: {
    activeConversations: number;
    hotLeads: number;
    pendingTasks: number;
    proposals: number;
    scheduledMessages: number;
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
  stageDistribution: Array<{
    stage: string;
    count: number;
  }>;
  productVolume: Array<{
    product: string;
    count: number;
    value: number;
  }>;
};

export type ReportsFilters = {
  from?: string;
  to?: string;
  userId?: string;
  productId?: string;
};

export type ReportsData = {
  filters: { from: string; to: string };
  users: Array<{ id: string; name: string | null }>;
  products: Array<{ id: string; name: string }>;
  financial: {
    totalRevenue: number;
    dealCount: number;
    averageTicket: number;
    signalRevenue: number;
    monthlyRevenue: Array<{ month: string; revenue: number; deals: number }>;
    cashForecast: Array<{ date: string; client: string; value: number }>;
    paymentDistribution: Array<{ name: string; value: number; revenue: number }>;
    signalDistribution: Array<{ name: string; value: number; revenue: number }>;
    projectDurations: Array<{ name: string; value: number }>;
  };
  commercial: {
    winRate: number;
    totalLeads: number;
    wonLeads: number;
    averageSalesCycleDays: number;
    funnel: Array<{ stage: string; count: number }>;
    leadsByOrigin: Array<{ origin: string; leads: number; won: number; conversion: number; revenue: number }>;
    productsSold: Array<{ product: string; productId: string | null; count: number; revenue: number }>;
    sellersRanking: Array<{ seller: string; deals: number; revenue: number; averageTicket: number; averageCycleDays: number }>;
    temperatureConversion: Array<{ temperature: string; total: number; won: number; conversion: number }>;
  };
  pipeline: {
    valueByStage: Array<{ stage: string; leads: number; value: number }>;
    stagnantLeads: Array<{ id: string; name: string; stage: string; days: number; value: number }>;
    tasksByUser: Array<{ user: string; pending: number; overdue: number }>;
    upcomingMeetings: Array<{ id: string; title: string; date: string; closer: string | null }>;
  };
  risk: {
    highRiskLeads: Array<{ id: string; name: string; risk: string; urgency: string; nextStep: string; createdAt: string }>;
    staleConversations: Array<{ id: string; name: string; stage: string; days: number }>;
  };
};

export type ContactProductData = {
  id: string;
  productId: string | null;
  customName: string | null;
  customPrice: number | null;
  originalPrice: number | null;
  name: string;
};

export type ClosedDealSummaryData = {
  id: string;
  totalValue: number;
  installmentCount: number | null;
  firstPaymentValue: number | null;
  firstPaymentDate: number | null;
  projectDuration: string | null;
  paymentMethod: string | null;
  hasSignal: boolean;
  signalValue: number | null;
  notes: string | null;
  closedAt: string;
};

export type ClosedDealProductSnapshot = {
  productId: string | null;
  name: string;
  price: number | null;
};

export type ClosedDealFormData = {
  lead: {
    id: string;
    name: string;
    company: string | null;
    phone: string;
    email: string | null;
  };
  totalValue: number;
  products: ClosedDealProductSnapshot[];
  existingDeal: (ClosedDealSummaryData & { notes: string | null }) | null;
};

export type ClosedDealDispatchInput = {
  targetStage?: string;
  installmentCount: number;
  firstPaymentDate: number;
  projectDuration: string;
  paymentMethod: string;
  hasSignal: boolean;
  signalValue?: number | null;
  notes?: string | null;
};

export type LeadData = {
  id: string;
  name: string;
  company: string;
  stage: string;
  stageKey: string;
  temperature: string;
  value: string;
  potentialValue: number | null;
  lastContact: string;
  origin: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  conversationId: string | null;
  monthlyRevenue: number | null;
  mainChallenges: string | null;
  productId: string | null;
  productName: string | null;
  productIds: string[];
  productNames: string[];
  totalProductValue: number | null;
  totalProductValueFormatted: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  lastContactAt: string | null;
  openTasksCount: number;
  overdueTasksCount: number;
  nextTask: {
    id: string;
    title: string;
    due: string;
    dueAt: string | null;
    priority: string;
  } | null;
  latestRiskLevel: string | null;
  latestUrgency: string | null;
  latestNextStep: string | null;
  closedDeal: ClosedDealSummaryData | null;
  contactProducts?: ContactProductData[];
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
  visible: boolean;
};

export type TaskData = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  contact: string;
  due: string;
  dueAt: string | null;
  reminderAt: string | null;
  priority: string;
  status: string;
  source: string;
  completedAt: string | null;
  completedByName: string | null;
  contactId: string | null;
  contactPhone: string | null;
  contactCompany: string | null;
  contactStage: string | null;
  contactStageKey: string | null;
  contactProductNames: string[];
  conversationId: string | null;
  analysisId: string | null;
  ownerName: string | null;
  ownerId: string | null;
  isLead: boolean;
};

export type ConversationMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  type: string;
  text: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaStatus?: string | null;
  mediaError?: string | null;
  time: string;
  timestamp: string;
  isEdited?: boolean;
  status?: string;
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
  timestamp?: string;
  msg: string;
  status: 'hot' | 'warm' | 'cold';
  unread: number;
  phone: string;
  email: string | null;
  interestArea: string | null;
  origin: string | null;
  notes: string | null;
  productId: string | null;
  productIds: string[];
  address: string | null;
  isLead: boolean;
  messageCount: number;
  canReply: boolean;
  avatarUrl: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  messages: ConversationMessage[];
  latestAnalysis: ConversationAnalysisData | null;
  contactProducts?: ContactProductData[];
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
  whatsappConnectionMeta: WhatsAppConnectionSettings | null;
  whatsappConnectionEvolution: WhatsAppConnectionSettings | null;
  activeProvider: string;
  openAIStatus: string;
  inngestStatus: string;
  promptTemplatesCount: number;
  promptTemplates: PromptTemplateData[];
  googleCalendarStatus: boolean;
  googleOAuthUrl: string;
  teamMembers: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  }[];
  maxUsers: number;
  currentMemberCount: number;
  currentUserRole: string;
  dealNotificationEmail: string | null;
  masterclassNotificationEmail: string | null;
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

type ClosedDealSnapshotSource = {
  potentialValue: number | null;
  productId: string | null;
  product: { name: string; price: number | null } | null;
  contactProducts: Array<{
    productId: string | null;
    customName: string | null;
    customPrice: number | null;
    product: { name: string; price: number | null } | null;
  }>;
};

function buildClosedDealSnapshot(contact: ClosedDealSnapshotSource) {
  const products: ClosedDealProductSnapshot[] = contact.contactProducts.length > 0
    ? contact.contactProducts.map((contactProduct) => ({
      productId: contactProduct.productId,
      name: contactProduct.customName || contactProduct.product?.name || 'Produto sem nome',
      price: contactProduct.customPrice !== null ? contactProduct.customPrice : (contactProduct.product?.price ?? null),
    }))
    : contact.product
      ? [{ productId: contact.productId, name: contact.product.name, price: contact.product.price }]
      : [];

  const totalValue = products.length > 0
    ? products.reduce((sum, product) => sum + (product.price || 0), 0)
    : (contact.potentialValue || 0);

  return { products, totalValue };
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function getReportDateRange(filters?: ReportsFilters) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const from = filters?.from ? startOfDay(new Date(`${filters.from}T00:00:00`)) : startOfDay(defaultFrom);
  const to = filters?.to ? endOfDay(new Date(`${filters.to}T00:00:00`)) : endOfDay(now);

  return {
    from: Number.isNaN(from.getTime()) ? startOfDay(defaultFrom) : from,
    to: Number.isNaN(to.getTime()) ? endOfDay(now) : to,
  };
}

function getMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(value);
}

function getClosedDealProductsFromJson(value: unknown): ClosedDealProductSnapshot[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const product = item as Record<string, unknown>;
      const name = typeof product.name === 'string' ? product.name : 'Produto sem nome';
      const productId = typeof product.productId === 'string' ? product.productId : null;
      const price = typeof product.price === 'number' ? product.price : null;
      return { productId, name, price };
    })
    .filter((item): item is ClosedDealProductSnapshot => Boolean(item));
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

  if (type === 'CONTACT' && content) {
    try {
      const parsed = JSON.parse(content);
      const contacts = parsed.contacts || (parsed.name ? [parsed] : []);
      if (contacts.length === 0) return 'Contato recebido';
      if (contacts.length === 1) {
        const first = contacts[0];
        if (first.name && first.phone) {
          return `Contato: ${first.name} (${first.phone})`;
        }
        return `Contato: ${first.name || 'Sem nome'}`;
      }
      if (contacts.length === 2) {
        return `Contatos: ${contacts[0].name} e ${contacts[1].name}`;
      }
      return `Contatos: ${contacts[0].name} e ${contacts.length - 1} outros contatos`;
    } catch {
      return content.startsWith('Contato:') ? content : `Contato: ${content}`;
    }
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

function isMediaMessageType(type: string) {
  return ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'].includes(type);
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

export async function getReportsData(filters?: ReportsFilters): Promise<ReportsData> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;
  const targetUserId = workspace.role === 'owner' ? filters?.userId : workspace.id;
  const productFilter = filters?.productId || undefined;
  const { from, to } = getReportDateRange(filters);
  const now = new Date();

  const contactRelationFilter: any = { organizationId: orgId };
  if (targetUserId) contactRelationFilter.assignedUserId = targetUserId;
  if (productFilter) {
    contactRelationFilter.OR = [
      { productId: productFilter },
      { contactProducts: { some: { productId: productFilter } } },
    ];
  }

  const dealWhere: any = {
    organizationId: orgId,
    closedAt: { gte: from, lte: to },
  };
  if (targetUserId) dealWhere.closedByUserId = targetUserId;

  const [users, products, dealsRaw, futureDealsRaw, periodContactsRaw, pipelineContactsRaw, stageCounts, temperatureCounts, tasks, meetings, highRiskAnalyses, staleConversationsRaw] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.closedDeal.findMany({
      where: dealWhere,
      orderBy: { closedAt: 'asc' },
      include: {
        closedBy: { select: { name: true } },
        contact: {
          select: {
            id: true,
            name: true,
            origin: true,
            createdAt: true,
            assignedUser: { select: { name: true } },
            conversations: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { temperature: true },
            },
          },
        },
      },
    }),
    prisma.closedDeal.findMany({
      where: {
        organizationId: orgId,
        firstPaymentDate: { not: null },
        ...(targetUserId ? { closedByUserId: targetUserId } : {}),
      },
      include: { contact: { select: { name: true } } },
    }),
    prisma.contact.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: from, lte: to },
        ...(targetUserId ? { assignedUserId: targetUserId } : {}),
      },
      select: {
        id: true,
        origin: true,
        productId: true,
        contactProducts: { select: { productId: true } },
      },
    }),
    prisma.contact.findMany({
      where: {
        organizationId: orgId,
        isLead: true,
        ...(targetUserId ? { assignedUserId: targetUserId } : {}),
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        potentialValue: true,
        productId: true,
        product: { select: { name: true, price: true } },
        contactProducts: {
          select: {
            productId: true,
            customName: true,
            customPrice: true,
            product: { select: { name: true, price: true } },
          },
        },
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true, stage: true, lastMessageAt: true },
        },
        leadHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.conversation.groupBy({
      by: ['stage'],
      where: { contact: contactRelationFilter },
      _count: { _all: true },
    }),
    prisma.conversation.groupBy({
      by: ['temperature'],
      where: { contact: contactRelationFilter },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: {
        status: { not: 'DONE' },
        user: { organizationId: orgId, ...(targetUserId ? { id: targetUserId } : {}) },
      },
      select: { dueAt: true, user: { select: { name: true } } },
    }),
    prisma.meeting.findMany({
      where: {
        organizationId: orgId,
        scheduledAt: { gte: startOfDay(now), lte: endOfDay(addDays(now, 14)) },
        ...(targetUserId ? { closerId: targetUserId } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      take: 8,
      select: { id: true, title: true, scheduledAt: true, closer: { select: { name: true } } },
    }),
    prisma.aIAnalysis.findMany({
      where: {
        riskLevel: 'ALTO',
        conversation: { contact: contactRelationFilter },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        riskLevel: true,
        urgency: true,
        nextConcreteStep: true,
        createdAt: true,
        conversation: { select: { id: true, contact: { select: { name: true } } } },
      },
    }),
    prisma.conversation.findMany({
      where: {
        status: 'OPEN',
        lastMessageAt: { lt: addDays(now, -7) },
        contact: contactRelationFilter,
      },
      orderBy: { lastMessageAt: 'asc' },
      take: 20,
      select: { id: true, stage: true, lastMessageAt: true, contact: { select: { name: true } } },
    }),
  ]);

  const contactMatchesProduct = (contact: { productId: string | null; contactProducts: Array<{ productId: string | null }> }) => {
    if (!productFilter) return true;
    return contact.productId === productFilter || contact.contactProducts.some((product) => product.productId === productFilter);
  };
  const dealMatchesProduct = (deal: { productsJson: unknown }) => {
    if (!productFilter) return true;
    return getClosedDealProductsFromJson(deal.productsJson).some((product) => product.productId === productFilter);
  };

  const deals = dealsRaw.filter(dealMatchesProduct);
  const futureDeals = futureDealsRaw.filter(dealMatchesProduct);
  const periodContacts = periodContactsRaw.filter(contactMatchesProduct);
  const pipelineContacts = pipelineContactsRaw.filter(contactMatchesProduct);
  const totalRevenue = deals.reduce((sum, deal) => sum + deal.totalValue, 0);
  const dealCount = deals.length;
  const averageTicket = dealCount > 0 ? totalRevenue / dealCount : 0;
  const signalRevenue = deals.reduce((sum, deal) => sum + (deal.signalValue || 0), 0);

  const monthlyMap = new Map<string, { month: string; revenue: number; deals: number }>();
  const monthCursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const monthLimit = new Date(to.getFullYear(), to.getMonth(), 1);
  while (monthCursor <= monthLimit) {
    monthlyMap.set(getMonthKey(monthCursor), { month: getMonthLabel(monthCursor), revenue: 0, deals: 0 });
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }
  for (const deal of deals) {
    const key = getMonthKey(deal.closedAt);
    const current = monthlyMap.get(key) || { month: getMonthLabel(deal.closedAt), revenue: 0, deals: 0 };
    current.revenue += deal.totalValue;
    current.deals += 1;
    monthlyMap.set(key, current);
  }

  const paymentMap = new Map<string, { name: string; value: number; revenue: number }>();
  const signalMap = new Map<string, { name: string; value: number; revenue: number }>();
  const durationMap = new Map<string, { name: string; value: number }>();
  const originMap = new Map<string, { origin: string; leads: number; won: number; conversion: number; revenue: number }>();
  const productMap = new Map<string, { product: string; productId: string | null; count: number; revenue: number }>();
  const sellerMap = new Map<string, { seller: string; deals: number; revenue: number; cycleDays: number }>();
  const wonByTemperature = new Map<string, number>();

  for (const contact of periodContacts) {
    const origin = contact.origin || 'Nao informado';
    if (!originMap.has(origin)) originMap.set(origin, { origin, leads: 0, won: 0, conversion: 0, revenue: 0 });
    originMap.get(origin)!.leads += 1;
  }

  for (const deal of deals) {
    const payment = deal.paymentMethod || 'Nao informado';
    const paymentCurrent = paymentMap.get(payment) || { name: payment, value: 0, revenue: 0 };
    paymentCurrent.value += 1;
    paymentCurrent.revenue += deal.totalValue;
    paymentMap.set(payment, paymentCurrent);

    const signal = deal.hasSignal ? 'Com sinal' : 'Sem sinal';
    const signalCurrent = signalMap.get(signal) || { name: signal, value: 0, revenue: 0 };
    signalCurrent.value += 1;
    signalCurrent.revenue += deal.signalValue || 0;
    signalMap.set(signal, signalCurrent);

    const duration = deal.projectDuration || 'Nao informado';
    const durationCurrent = durationMap.get(duration) || { name: duration, value: 0 };
    durationCurrent.value += 1;
    durationMap.set(duration, durationCurrent);

    const origin = deal.contact.origin || 'Nao informado';
    if (!originMap.has(origin)) originMap.set(origin, { origin, leads: 0, won: 0, conversion: 0, revenue: 0 });
    const originCurrent = originMap.get(origin)!;
    originCurrent.won += 1;
    originCurrent.revenue += deal.totalValue;

    const dealProducts = getClosedDealProductsFromJson(deal.productsJson);
    for (const product of dealProducts.length > 0 ? dealProducts : [{ productId: null, name: 'Sem produto', price: deal.totalValue }]) {
      const key = product.productId || product.name;
      const current = productMap.get(key) || { product: product.name, productId: product.productId, count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += product.price || (dealProducts.length <= 1 ? deal.totalValue : 0);
      productMap.set(key, current);
    }

    const seller = deal.closedBy?.name || deal.contact.assignedUser?.name || 'Sem vendedor';
    const sellerCurrent = sellerMap.get(seller) || { seller, deals: 0, revenue: 0, cycleDays: 0 };
    sellerCurrent.deals += 1;
    sellerCurrent.revenue += deal.totalValue;
    sellerCurrent.cycleDays += Math.max(0, Math.round((deal.closedAt.getTime() - deal.contact.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    sellerMap.set(seller, sellerCurrent);

    const temperature = deal.contact.conversations[0]?.temperature || 'COLD';
    wonByTemperature.set(temperature, (wonByTemperature.get(temperature) || 0) + 1);
  }

  const leadsByOrigin = Array.from(originMap.values())
    .map((origin) => ({ ...origin, conversion: origin.leads > 0 ? (origin.won / origin.leads) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);

  const sellersRanking = Array.from(sellerMap.values())
    .map((seller) => ({
      seller: seller.seller,
      deals: seller.deals,
      revenue: seller.revenue,
      averageTicket: seller.deals > 0 ? seller.revenue / seller.deals : 0,
      averageCycleDays: seller.deals > 0 ? seller.cycleDays / seller.deals : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const pipelineStageMap = new Map<string, { stage: string; leads: number; value: number }>();
  const stagnantLeads = pipelineContacts.map((contact) => {
    const latestConversation = contact.conversations[0] || null;
    const snapshot = buildClosedDealSnapshot(contact);
    const stage = normalizeStageLabel(latestConversation?.stage);
    const lastStageChange = contact.leadHistory[0]?.createdAt || contact.updatedAt;
    const days = Math.floor((now.getTime() - lastStageChange.getTime()) / (1000 * 60 * 60 * 24));
    const stageCurrent = pipelineStageMap.get(stage) || { stage, leads: 0, value: 0 };
    stageCurrent.leads += 1;
    stageCurrent.value += snapshot.totalValue;
    pipelineStageMap.set(stage, stageCurrent);
    return { id: contact.id, name: contact.name, stage, days, value: snapshot.totalValue };
  }).filter((lead) => lead.days >= 14).sort((a, b) => b.days - a.days).slice(0, 20);

  const tasksByUserMap = new Map<string, { user: string; pending: number; overdue: number }>();
  for (const task of tasks) {
    const user = task.user.name || 'Sem nome';
    const current = tasksByUserMap.get(user) || { user, pending: 0, overdue: 0 };
    current.pending += 1;
    if (task.dueAt && task.dueAt < now) current.overdue += 1;
    tasksByUserMap.set(user, current);
  }

  const temperatureConversion = ['HOT', 'WARM', 'COLD'].map((temperature) => {
    const total = temperatureCounts.find((row) => row.temperature === temperature)?._count._all || 0;
    const won = wonByTemperature.get(temperature) || 0;
    return { temperature, total, won, conversion: total > 0 ? (won / total) * 100 : 0 };
  });

  const averageSalesCycleDays = deals.length > 0
    ? deals.reduce((sum, deal) => sum + Math.max(0, (deal.closedAt.getTime() - deal.contact.createdAt.getTime()) / (1000 * 60 * 60 * 24)), 0) / deals.length
    : 0;

  return {
    filters: { from: formatDateInput(from), to: formatDateInput(to) },
    users,
    products,
    financial: {
      totalRevenue,
      dealCount,
      averageTicket,
      signalRevenue,
      monthlyRevenue: Array.from(monthlyMap.values()),
      cashForecast: futureDeals
        .map((deal) => {
          const day = deal.firstPaymentDate;
          let forecastDate: Date | null = null;
          if (day) {
            forecastDate = new Date(now.getFullYear(), now.getMonth(), day);
            if (forecastDate < now) {
              forecastDate = new Date(now.getFullYear(), now.getMonth() + 1, day);
            }
          }
          return {
            date: forecastDate?.toISOString() || '',
            client: deal.contact.name,
            value: deal.firstPaymentValue || 0,
          };
        })
        .sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        })
        .slice(0, 30),
      paymentDistribution: Array.from(paymentMap.values()).sort((a, b) => b.value - a.value),
      signalDistribution: Array.from(signalMap.values()).sort((a, b) => b.value - a.value),
      projectDurations: Array.from(durationMap.values()).sort((a, b) => b.value - a.value),
    },
    commercial: {
      winRate: periodContacts.length > 0 ? (deals.length / periodContacts.length) * 100 : 0,
      totalLeads: periodContacts.length,
      wonLeads: deals.length,
      averageSalesCycleDays,
      funnel: stageCounts.map((row) => ({ stage: normalizeStageLabel(row.stage), count: row._count._all })).sort((a, b) => b.count - a.count),
      leadsByOrigin,
      productsSold: Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue),
      sellersRanking,
      temperatureConversion,
    },
    pipeline: {
      valueByStage: Array.from(pipelineStageMap.values()).sort((a, b) => b.value - a.value),
      stagnantLeads,
      tasksByUser: Array.from(tasksByUserMap.values()).sort((a, b) => b.overdue - a.overdue || b.pending - a.pending),
      upcomingMeetings: meetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        date: meeting.scheduledAt.toISOString(),
        closer: meeting.closer.name,
      })),
    },
    risk: {
      highRiskLeads: highRiskAnalyses.map((analysis) => ({
        id: analysis.conversation.id,
        name: analysis.conversation.contact.name,
        risk: analysis.riskLevel,
        urgency: analysis.urgency,
        nextStep: analysis.nextConcreteStep,
        createdAt: analysis.createdAt.toISOString(),
      })),
      staleConversations: staleConversationsRaw.map((conversation) => ({
        id: conversation.id,
        name: conversation.contact.name,
        stage: normalizeStageLabel(conversation.stage),
        days: conversation.lastMessageAt ? Math.floor((now.getTime() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24)) : 999,
      })),
    },
  };
}

export async function getDashboardData(filters?: { userId?: string; month?: number; year?: number }): Promise<DashboardData> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  // Se não for owner, força o filtro para o próprio usuário
  const targetUserId = workspace.role === 'owner' ? filters?.userId : workspace.id;

  const conversationFilter: any = { contact: { organizationId: orgId } };
  if (targetUserId) {
    conversationFilter.whatsAppConnection = { userId: targetUserId };
  }
  if (filters?.month && filters?.year) {
    const startDate = new Date(filters.year, filters.month - 1, 1);
    const endDate = new Date(filters.year, filters.month, 1);
    conversationFilter.createdAt = { gte: startDate, lt: endDate };
  }

  const leadConversationFilter = {
    ...conversationFilter,
    contact: { ...conversationFilter.contact, isLead: true },
  };

  const contactProductFilter: any = {
    productId: { not: null },
    contact: {
      organizationId: orgId,
      isLead: true,
      ...(targetUserId ? { assignedUserId: targetUserId } : {}),
    },
  };

  const [
    activeConversations,
    hotLeads,
    pendingTasks,
    proposals,
    scheduledMessages,
    recentAnalyses,
    urgentConversations,
    stageGroups,
    productGroups,
  ] = await Promise.all([
    prisma.conversation.count({ where: { ...conversationFilter, status: 'OPEN' } }),
    prisma.conversation.count({ where: { ...conversationFilter, temperature: 'HOT' } }),
    prisma.task.count({ where: { user: { organizationId: orgId, ...(targetUserId ? { id: targetUserId } : {}) }, status: 'PENDING' } }),
    prisma.conversation.count({ where: { ...conversationFilter, stage: 'APRESENTACAO_PROPOSTA' } }),
    prisma.scheduledMessage.count({ where: { conversation: conversationFilter, status: 'PENDING' } }),
    prisma.aIAnalysis.findMany({
      where: { conversation: conversationFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        createdAt: true,
        stage: true,
        riskLevel: true,
        conversation: {
          select: {
            contact: { select: { name: true } },
          },
        },
      },
    }),
    prisma.conversation.findMany({
      where: {
        ...conversationFilter,
        status: 'OPEN',
        temperature: 'HOT',
        lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        temperature: true,
        lastMessageAt: true,
        contact: { select: { name: true, company: true } },
      },
      orderBy: { lastMessageAt: 'asc' },
      take: 5,
    }),
    prisma.conversation.groupBy({
      by: ['stage'],
      where: leadConversationFilter,
      _count: { _all: true },
    }),
    prisma.contactProduct.groupBy({
      by: ['productId'],
      where: contactProductFilter,
      _count: { productId: true },
    }),
  ]);

  const stageDistribution = stageGroups.map((group) => ({
    stage: group.stage,
    count: group._count._all,
  }));

  const productIds = productGroups.map((group) => group.productId).filter(Boolean) as string[];
  const products = productIds.length > 0
    ? await prisma.product.findMany({
      where: { id: { in: productIds }, organizationId: orgId },
      select: { id: true, name: true, price: true },
    })
    : [];
  const productById = new Map(products.map((product) => [product.id, product]));
  const prodMap = new Map<string, { count: number; value: number }>();
  productGroups.forEach((group) => {
    if (!group.productId) return;
    const product = productById.get(group.productId);
    if (!product) return;
    const count = group._count.productId;
    const existing = prodMap.get(product.name) || { count: 0, value: 0 };
    prodMap.set(product.name, {
      count: existing.count + count,
      value: existing.value + count * (product.price || 0),
    });
  });
  const productVolume = Array.from(prodMap.entries()).map(([product, { count, value }]) => ({ product, count, value }));

  return {
    kpis: {
      activeConversations,
      hotLeads,
      pendingTasks,
      proposals,
      scheduledMessages,
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
    stageDistribution,
    productVolume,
  };
}

async function rescueOrphanedConversations(orgId: string) {
  try {
    // Rescue legacy conversations missing a WhatsApp connection
    const ownerUser = await prisma.user.findFirst({
      where: { organizationId: orgId, role: 'owner' }
    });
    let ownerConnectionId: string | null = null;
    if (ownerUser) {
      const ownerConnection = await prisma.whatsAppConnection.findFirst({
        where: { organizationId: orgId, userId: ownerUser.id }
      });
      if (!ownerConnection) {
        const firstConnection = await prisma.whatsAppConnection.findFirst({
          where: { organizationId: orgId }
        });
        if (firstConnection) ownerConnectionId = firstConnection.id;
      } else {
        ownerConnectionId = ownerConnection.id;
      }
    }

    if (ownerConnectionId) {
      const convosWithoutConnection = await prisma.conversation.findMany({
        where: { contact: { organizationId: orgId }, whatsAppConnectionId: null },
        take: 500 // Process in chunks if there are many
      });

      if (convosWithoutConnection.length > 0) {
        console.log(`[RESCUE] Migrating ${convosWithoutConnection.length} conversations to connection ${ownerConnectionId}`);
        await prisma.conversation.updateMany({
          where: { id: { in: convosWithoutConnection.map(c => c.id) } },
          data: { whatsAppConnectionId: ownerConnectionId }
        });
      }
    }

    const stages = await prisma.pipelineStage.findMany({
      where: { organizationId: orgId },
      orderBy: { order: 'asc' },
    });

    if (stages.length === 0) return;

    const stageNames = stages.map(s => s.name);
    const firstStageName = stages[0].name;

    const orphanedConvos = await prisma.conversation.findMany({
      where: {
        contact: { organizationId: orgId },
        NOT: {
          stage: { in: stageNames }
        }
      }
    });

    if (orphanedConvos.length > 0) {
      console.log(`[RESCUE] Migrating ${orphanedConvos.length} orphaned conversations to "${firstStageName}"`);
      await prisma.conversation.updateMany({
        where: {
          id: { in: orphanedConvos.map(c => c.id) }
        },
        data: {
          stage: firstStageName
        }
      });
    }
  } catch (err) {
    console.error("Failed to rescue orphaned conversations:", err);
  }
}

export async function getLeads(options?: { limit?: number; cursor?: string; runMaintenance?: boolean }): Promise<LeadData[]> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  // Run self-healing rescue for orphaned stages in background (does not block read)
  if (options?.runMaintenance !== false) {
    rescueOrphanedConversations(orgId).catch(err => console.error("Background rescue failed:", err));
  }

  const take = options?.limit ? Math.min(Math.max(options.limit, 1), 500) : undefined;

  const leads = await prisma.contact.findMany({
    where: { organizationId: orgId, isLead: true },
    ...(take ? { take } : {}),
    ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      email: true,
      notes: true,
      origin: true,
      potentialValue: true,
      updatedAt: true,
      monthlyRevenue: true,
      mainChallenges: true,
      productId: true,
      assignedUserId: true,
      product: { select: { name: true, price: true } },
      assignedUser: { select: { name: true } },
      contactProducts: {
        select: {
          id: true,
          productId: true,
          customName: true,
          customPrice: true,
          product: { select: { name: true, price: true } },
        },
      },
      closedDeals: {
        orderBy: { closedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          totalValue: true,
          installmentCount: true,
          firstPaymentValue: true,
          firstPaymentDate: true,
          projectDuration: true,
          paymentMethod: true,
          hasSignal: true,
          signalValue: true,
          notes: true,
          closedAt: true,
        },
      },
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          stage: true,
          temperature: true,
          lastMessageAt: true,
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { riskLevel: true, urgency: true, nextConcreteStep: true },
          },
        },
      },
      tasks: {
        where: { status: { not: 'DONE' } },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 1,
        select: {
          id: true,
          title: true,
          dueAt: true,
          priority: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const leadIds = leads.map((lead) => lead.id);
  const now = new Date();
  const [openTaskCounts, overdueTaskCounts] = leadIds.length > 0
    ? await Promise.all([
      prisma.task.groupBy({
        by: ['contactId'],
        where: {
          contactId: { in: leadIds },
          status: { not: 'DONE' },
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ['contactId'],
        where: {
          contactId: { in: leadIds },
          status: { not: 'DONE' },
          dueAt: { lt: now },
        },
        _count: { _all: true },
      }),
    ])
    : [[], []];
  const openTaskCountByContactId = new Map(openTaskCounts.map((row) => [row.contactId, row._count._all]));
  const overdueTaskCountByContactId = new Map(overdueTaskCounts.map((row) => [row.contactId, row._count._all]));

  return leads.map((lead) => {
    const latestConversation = lead.conversations[0];
    const latestAnalysis = latestConversation?.analyses?.[0] || null;
    const nextTask = lead.tasks[0] || null;
    const lastContactAt = latestConversation?.lastMessageAt || lead.updatedAt;
    const totalProductValue = lead.contactProducts.length > 0
      ? lead.contactProducts.reduce((sum, cp) => sum + (cp.customPrice !== null ? cp.customPrice : (cp.product?.price || 0)), 0)
      : (lead.product?.price || null);
    const closedDeal = lead.closedDeals[0] || null;

    return {
      id: lead.id,
      name: lead.name,
      company: lead.company || 'Sem empresa',
      stage: normalizeStageLabel(latestConversation?.stage),
      stageKey: latestConversation?.stage || 'PRIMEIRO_CONTATO',
      temperature: latestConversation?.temperature || 'COLD',
      value: formatCurrency(lead.potentialValue),
      potentialValue: lead.potentialValue,
      lastContact: formatTimeLabel(latestConversation?.lastMessageAt || lead.updatedAt),
      origin: lead.origin || null,
      phone: lead.phone,
      email: lead.email,
      notes: lead.notes || null,
      conversationId: latestConversation?.id || null,
      monthlyRevenue: lead.monthlyRevenue,
      mainChallenges: lead.mainChallenges,
      productId: lead.productId,
      productName: lead.product?.name || null,
      productIds: lead.contactProducts.length > 0 ? lead.contactProducts.map(cp => cp.productId).filter(Boolean) as string[] : (lead.productId ? [lead.productId] : []),
      productNames: lead.contactProducts.length > 0 ? lead.contactProducts.map(cp => cp.customName || cp.product?.name || "Sem Nome") : (lead.product ? [lead.product.name] : []),
      totalProductValue,
      totalProductValueFormatted: lead.contactProducts.length > 0
        ? formatCurrency(totalProductValue)
        : (lead.product?.price ? formatCurrency(lead.product.price) : null),
      assignedUserId: lead.assignedUserId,
      assignedUserName: lead.assignedUser?.name || null,
      lastContactAt: lastContactAt?.toISOString() || null,
      openTasksCount: openTaskCountByContactId.get(lead.id) || 0,
      overdueTasksCount: overdueTaskCountByContactId.get(lead.id) || 0,
      nextTask: nextTask ? {
        id: nextTask.id,
        title: nextTask.title,
        due: nextTask.dueAt ? formatDateTime(nextTask.dueAt) : 'Sem data',
        dueAt: nextTask.dueAt?.toISOString() || null,
        priority: nextTask.priority,
      } : null,
      latestRiskLevel: latestAnalysis?.riskLevel || null,
      latestUrgency: latestAnalysis?.urgency || null,
      latestNextStep: latestAnalysis?.nextConcreteStep || null,
      closedDeal: closedDeal ? {
        id: closedDeal.id,
        totalValue: closedDeal.totalValue,
        installmentCount: closedDeal.installmentCount,
        firstPaymentValue: closedDeal.firstPaymentValue,
        firstPaymentDate: closedDeal.firstPaymentDate || null,
        projectDuration: closedDeal.projectDuration,
        paymentMethod: closedDeal.paymentMethod,
        hasSignal: closedDeal.hasSignal,
        signalValue: closedDeal.signalValue,
        notes: closedDeal.notes,
        closedAt: closedDeal.closedAt.toISOString(),
      } : null,
      contactProducts: lead.contactProducts.map(cp => ({
        id: cp.id,
        productId: cp.productId,
        customName: cp.customName,
        customPrice: cp.customPrice,
        originalPrice: cp.product?.price || null,
        name: cp.customName || cp.product?.name || "Sem Nome",
      })),
    };
  });
}

export async function getContactOptions(): Promise<Array<{ id: string; name: string; isLead: boolean; phone: string }>> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      isLead: true,
      phone: true,
    },
    orderBy: { name: 'asc' },
  });

  return contacts;
}

export async function getPipelineDashboardData(): Promise<{
  leads: LeadData[];
  stages: PipelineStageData[];
  products: ProductData[];
  origins: { id: string; name: string }[];
  users: any[];
}> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  // Run self-healing rescue for orphaned stages in background (throttled)
  rescueOrphanedConversations(orgId).catch(err => console.error("Background rescue failed:", err));

  const [leadsDb, stagesDb, productsDb, originsDb, usersDb, session] = await Promise.all([
    prisma.contact.findMany({
      where: { organizationId: orgId, isLead: true },
      select: {
        id: true,
        name: true,
        company: true,
        phone: true,
        email: true,
        notes: true,
        origin: true,
        potentialValue: true,
        updatedAt: true,
        monthlyRevenue: true,
        mainChallenges: true,
        productId: true,
        assignedUserId: true,
        product: { select: { name: true, price: true } },
        assignedUser: { select: { name: true } },
      contactProducts: {
        select: {
          id: true,
          productId: true,
          customName: true,
            customPrice: true,
          product: { select: { name: true, price: true } },
        },
      },
      closedDeals: {
        orderBy: { closedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          totalValue: true,
          installmentCount: true,
          firstPaymentValue: true,
          firstPaymentDate: true,
          projectDuration: true,
          paymentMethod: true,
          hasSignal: true,
          signalValue: true,
          notes: true,
          closedAt: true,
        },
      },
      conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            stage: true,
            temperature: true,
            lastMessageAt: true,
            analyses: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { riskLevel: true, urgency: true, nextConcreteStep: true },
            },
          },
        },
        tasks: {
          where: { status: { not: 'DONE' } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            title: true,
            dueAt: true,
            priority: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.pipelineStage.findMany({
      where: { organizationId: orgId },
      orderBy: { order: 'asc' },
    }),
    prisma.product.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.leadOrigin.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, email: true, role: true, googleAccessToken: true },
      orderBy: { name: 'asc' }
    }),
    auth()
  ]);

  let stages: PipelineStageData[] = stagesDb;
  if (stages.length === 0) {
    stages = await getPipelineStages();
  }

  const leadIds = leadsDb.map((l) => l.id);
  const now = new Date();
  const [openTaskCounts, overdueTaskCounts] = leadIds.length > 0
    ? await Promise.all([
      prisma.task.groupBy({
        by: ['contactId'],
        where: {
          contactId: { in: leadIds },
          status: { not: 'DONE' },
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ['contactId'],
        where: {
          contactId: { in: leadIds },
          status: { not: 'DONE' },
          dueAt: { lt: now },
        },
        _count: { _all: true },
      }),
    ])
    : [[], []];

  const openTaskCountByContactId = new Map(openTaskCounts.map((row) => [row.contactId, row._count._all]));
  const overdueTaskCountByContactId = new Map(overdueTaskCounts.map((row) => [row.contactId, row._count._all]));

  const mappedLeads: LeadData[] = leadsDb.map((lead) => {
    const latestConversation = lead.conversations[0];
    const latestAnalysis = latestConversation?.analyses?.[0] || null;
    const nextTask = lead.tasks[0] || null;
    const lastContactAt = latestConversation?.lastMessageAt || lead.updatedAt;
    const totalProductValue = lead.contactProducts.length > 0
      ? lead.contactProducts.reduce((sum, cp) => sum + (cp.customPrice !== null ? cp.customPrice : (cp.product?.price || 0)), 0)
      : (lead.product?.price || null);
    const closedDeal = lead.closedDeals[0] || null;

    return {
      id: lead.id,
      name: lead.name,
      company: lead.company || 'Sem empresa',
      stage: normalizeStageLabel(latestConversation?.stage),
      stageKey: latestConversation?.stage || 'PRIMEIRO_CONTATO',
      temperature: latestConversation?.temperature || 'COLD',
      value: formatCurrency(lead.potentialValue),
      potentialValue: lead.potentialValue,
      lastContact: formatTimeLabel(latestConversation?.lastMessageAt || lead.updatedAt),
      origin: lead.origin || null,
      phone: lead.phone,
      email: lead.email,
      notes: lead.notes || null,
      conversationId: latestConversation?.id || null,
      monthlyRevenue: lead.monthlyRevenue,
      mainChallenges: lead.mainChallenges,
      productId: lead.productId,
      productName: lead.product?.name || null,
      productIds: lead.contactProducts.length > 0 ? lead.contactProducts.map(cp => cp.productId).filter(Boolean) as string[] : (lead.productId ? [lead.productId] : []),
      productNames: lead.contactProducts.length > 0 ? lead.contactProducts.map(cp => cp.customName || cp.product?.name || "Sem Nome") : (lead.product ? [lead.product.name] : []),
      totalProductValue,
      totalProductValueFormatted: lead.contactProducts.length > 0
        ? formatCurrency(totalProductValue)
        : (lead.product?.price ? formatCurrency(lead.product.price) : null),
      assignedUserId: lead.assignedUserId,
      assignedUserName: lead.assignedUser?.name || null,
      lastContactAt: lastContactAt?.toISOString() || null,
      openTasksCount: openTaskCountByContactId.get(lead.id) || 0,
      overdueTasksCount: overdueTaskCountByContactId.get(lead.id) || 0,
      nextTask: nextTask ? {
        id: nextTask.id,
        title: nextTask.title,
        due: nextTask.dueAt ? formatDateTime(nextTask.dueAt) : 'Sem data',
        dueAt: nextTask.dueAt?.toISOString() || null,
        priority: nextTask.priority,
      } : null,
      latestRiskLevel: latestAnalysis?.riskLevel || null,
      latestUrgency: latestAnalysis?.urgency || null,
      latestNextStep: latestAnalysis?.nextConcreteStep || null,
      closedDeal: closedDeal ? {
        id: closedDeal.id,
        totalValue: closedDeal.totalValue,
        installmentCount: closedDeal.installmentCount,
        firstPaymentValue: closedDeal.firstPaymentValue,
        firstPaymentDate: closedDeal.firstPaymentDate || null,
        projectDuration: closedDeal.projectDuration,
        paymentMethod: closedDeal.paymentMethod,
        hasSignal: closedDeal.hasSignal,
        signalValue: closedDeal.signalValue,
        notes: closedDeal.notes,
        closedAt: closedDeal.closedAt.toISOString(),
      } : null,
      contactProducts: lead.contactProducts.map(cp => ({
        id: cp.id,
        productId: cp.productId,
        customName: cp.customName,
        customPrice: cp.customPrice,
        originalPrice: cp.product?.price || null,
        name: cp.customName || cp.product?.name || "Sem Nome",
      })),
    };
  });

  let users = usersDb;
  if (session?.userId) {
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: session.userId },
      select: { id: true, name: true, email: true, role: true, googleAccessToken: true }
    });
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      users.unshift(currentUser);
    }
  }

  return {
    leads: mappedLeads,
    stages,
    products: productsDb,
    origins: originsDb,
    users
  };
}

export async function updateConversationStage(conversationId: string, stage: string) {
  const workspace = await ensurePaidWorkspace();

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      contact: { organizationId: workspace.organizationId },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Verifica se o estágio corresponde a lead perdido (case-insensitive)
  const stageLower = stage.toLowerCase();
  const isLostStage = stageLower.includes("perdido") || stageLower.includes("lost") || stageLower === "cliente_perdido";

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { stage },
  });

  if (conversation.stage !== stage) {
    await prisma.leadStageHistory.create({
      data: {
        contactId: conversation.contactId,
        fromStage: conversation.stage,
        toStage: stage,
        reason: 'Atualizacao manual de etapa',
        changedBy: workspace.id,
      },
    });
  }

  // Atualiza a flag isLead do contato
  await prisma.contact.update({
    where: { id: conversation.contactId },
    data: { isLead: !isLostStage },
  });

  return updated;
}

export async function updateConversationTemperature(conversationId: string, temperature: string) {
  const workspace = await ensurePaidWorkspace();

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
    data: { temperature },
  });

  return updated;
}

const taskInclude = {
  conversation: {
    select: { id: true, stage: true },
  },
  contact: {
    select: {
      name: true,
      phone: true,
      company: true,
      isLead: true,
      product: { select: { name: true } },
      contactProducts: {
        select: {
          customName: true,
          product: { select: { name: true } },
        },
      },
      conversations: {
        orderBy: { updatedAt: 'desc' as const },
        take: 1,
        select: { id: true, stage: true },
      },
    },
  },
  user: {
    select: { name: true, email: true },
  },
  completedBy: {
    select: { name: true, email: true },
  },
};

function mapTaskData(task: any): TaskData {
  const latestConversation = task.conversation || task.contact?.conversations?.[0] || null;
  const contactProducts = task.contact?.contactProducts || [];
  const productNames = contactProducts.length > 0
    ? contactProducts.map((cp: any) => cp.customName || cp.product?.name || "Sem nome")
    : task.contact?.product?.name
      ? [task.contact.product.name]
      : [];

  return {
    id: task.id,
    title: task.title,
    description: task.description || null,
    type: task.type,
    contact: task.contact?.name || 'Sem contato',
    due: task.dueAt ? formatDateTime(task.dueAt) : 'Sem data',
    dueAt: task.dueAt?.toISOString() || null,
    reminderAt: task.reminderAt?.toISOString() || null,
    priority: task.priority,
    status: task.status,
    source: task.source || 'MANUAL',
    completedAt: task.completedAt?.toISOString() || null,
    completedByName: task.completedBy?.name || task.completedBy?.email || null,
    contactId: task.contactId,
    contactPhone: task.contact?.phone || null,
    contactCompany: task.contact?.company || null,
    contactStage: latestConversation?.stage ? normalizeStageLabel(latestConversation.stage) : null,
    contactStageKey: latestConversation?.stage || null,
    contactProductNames: productNames,
    conversationId: latestConversation?.id || null,
    analysisId: task.analysisId || null,
    ownerName: task.user?.name || task.user?.email || null,
    ownerId: task.userId,
    isLead: task.contact?.isLead ?? false,
  };
}

export async function getTasks(filters?: { contactId?: string; status?: string; limit?: number }): Promise<TaskData[]> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  const where: any = { user: { organizationId: orgId } };

  if (filters?.contactId) {
    where.contactId = filters.contactId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    ...(filters?.limit ? { take: Math.min(Math.max(filters.limit, 1), 500) } : {}),
  });

  return tasks.map(mapTaskData);
}

export async function createTask(input: {
  title: string;
  type?: string;
  priority?: string;
  dueAt?: string;
  reminderAt?: string;
  contactId?: string | null;
  description?: string;
  userId?: string | null;
  source?: string;
  conversationId?: string | null;
  analysisId?: string | null;
}) {
  const workspace = await ensurePaidWorkspace();

  if (!input.title.trim()) {
    throw new Error('Task title is required');
  }

  let taskContactId = input.contactId || null;
  let taskConversationId = input.conversationId || null;
  let taskAnalysisId = input.analysisId || null;
  let taskUserId = input.userId || workspace.id;

  if (taskContactId) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: taskContactId,
        organizationId: workspace.organizationId,
      },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }
  }

  if (taskConversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: taskConversationId,
        contact: { organizationId: workspace.organizationId },
      },
      select: { contactId: true },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    taskContactId = taskContactId || conversation.contactId;
  } else if (taskContactId) {
    const latestConversation = await prisma.conversation.findFirst({
      where: { contactId: taskContactId, contact: { organizationId: workspace.organizationId } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    taskConversationId = latestConversation?.id || null;
  }

  if (taskAnalysisId) {
    const analysis = await prisma.aIAnalysis.findFirst({
      where: {
        id: taskAnalysisId,
        conversation: { contact: { organizationId: workspace.organizationId } },
      },
      select: { conversationId: true },
    });

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    taskConversationId = taskConversationId || analysis.conversationId;
  }

  if (input.userId) {
    const assignee = await prisma.user.findFirst({
      where: { id: input.userId, organizationId: workspace.organizationId },
      select: { id: true },
    });

    if (!assignee) {
      throw new Error('Assignee not found');
    }

    taskUserId = assignee.id;
  }

  const created = await prisma.task.create({
    data: {
      userId: taskUserId,
      contactId: taskContactId,
      title: input.title.trim(),
      description: input.description || null,
      type: input.type || 'FOLLOW_UP',
      priority: input.priority || 'MEDIUM',
      source: input.source || 'MANUAL',
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
      conversationId: taskConversationId,
      analysisId: taskAnalysisId,
    },
    include: taskInclude,
  });



  return mapTaskData(created);
}

export async function toggleTaskStatus(taskId: string, currentStatus: string) {
  const workspace = await ensurePaidWorkspace();
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
      completedById: nextStatus === 'DONE' ? workspace.id : null,
    },
  });



  return {
    id: updated.id,
    status: updated.status,
    completedAt: updated.completedAt?.toISOString() || null,
  };
}

export async function rescheduleTask(taskId: string, dueAt: string | null) {
  const workspace = await ensurePaidWorkspace();

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
      dueAt: dueAt ? new Date(dueAt) : null,
    },
    include: taskInclude,
  });

  return mapTaskData(updated);
}

export async function updateTask(taskId: string, data: {
  description?: string | null;
  priority?: string;
  userId?: string;
  dueAt?: string | null;
  status?: string;
}) {
  const workspace = await ensurePaidWorkspace();

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      user: { organizationId: workspace.organizationId },
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority) updateData.priority = data.priority;
  if (data.userId) updateData.userId = data.userId;
  if (data.dueAt !== undefined) updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null;
  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'DONE') {
      updateData.completedAt = new Date();
      updateData.completedById = workspace.id;
    } else if (task.status === 'DONE') {
      updateData.completedAt = null;
      updateData.completedById = null;
    }
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: updateData,
    include: taskInclude,
  });

  return mapTaskData(updated);
}

export async function deleteTask(taskId: string) {
  const workspace = await ensurePaidWorkspace();

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      user: { organizationId: workspace.organizationId },
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  await prisma.task.delete({ where: { id: task.id } });

  return { success: true };
}

type GetConversationsOptions = {
  messageLimit?: number;
  includeMediaUrls?: boolean;
  includeAnalysis?: boolean;
  includeConnections?: boolean;
  runMaintenance?: boolean;
  assignedToMe?: boolean;
};

export async function getConversations(since?: string, filterConnectionId?: string, options: GetConversationsOptions = {}): Promise<{
  conversations: ConversationData[];
  orgId: string;
  syncTime: string;
  connectionStatus: string;
  connections?: { id: string; name: string }[];
}> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;
  const syncTime = new Date().toISOString();
  const messageLimit = options.messageLimit ?? 50;
  const includeMediaUrls = options.includeMediaUrls ?? true;
  const includeAnalysis = options.includeAnalysis ?? true;
  const includeConnections = options.includeConnections ?? true;
  const runMaintenance = options.runMaintenance ?? !since;
  const assignedToMe = options.assignedToMe ?? true;

  if (runMaintenance) {
    // Keep expensive self-healing out of high-frequency polling requests.
    rescueOrphanedConversations(orgId).catch(err => console.error("Background rescue failed:", err));
  }

  const whatsappConnection = await prisma.whatsAppConnection.findFirst({
    where: {
      organizationId: orgId,
      userId: workspace.id,
      provider: 'EVOLUTION',
    },
  });

  // Background self-healing connection check
  if (runMaintenance && whatsappConnection && whatsappConnection.status !== 'CONNECTED' && whatsappConnection.instanceName && whatsappConnection.instanceToken) {
    (async () => {
      try {
        const { decryptToken } = await import('@/lib/encryption');
        const token = decryptToken(whatsappConnection.instanceToken!);
        const statusData = await evolution.getInstanceStatus(whatsappConnection.instanceName!, token);
        const evolutionState = statusData?.instance?.state || statusData?.state;
        if (evolutionState === 'open' || evolutionState === 'CONNECTED') {
          await prisma.whatsAppConnection.update({
            where: { id: whatsappConnection.id },
            data: { status: 'CONNECTED', lastConnectedAt: new Date() }
          });
          console.log(`[DYNAMIC HEAL CONVERSATIONS] Restored status to CONNECTED for ${whatsappConnection.instanceName}`);
        }
      } catch (err) {
        console.warn('[DYNAMIC HEAL CONVERSATIONS] Background connection verification failed:', err);
      }
    })();
  }

  const allConnections = includeConnections && workspace.role === 'owner'
    ? await prisma.whatsAppConnection.findMany({
      where: { organizationId: orgId, provider: 'EVOLUTION' },
      select: { id: true, instanceName: true, status: true }
    })
    : [];

  const mappedConnections = allConnections.map(c => ({
    id: c.id,
    name: c.instanceName || 'Desconhecido',
  }));

  const filter: any = { contact: { organizationId: orgId } };
  const filterAnd: Record<string, unknown>[] = [];

  // Add connection filtering logic based on user role
  if (workspace.role !== 'owner') {
    const userConnection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId, userId: workspace.id, provider: 'EVOLUTION' }
    });

    const connectionOr: any[] = [];
    if (userConnection) {
      connectionOr.push({ whatsAppConnectionId: userConnection.id });
    } else {
      connectionOr.push({ whatsAppConnectionId: 'none' });
    }

    const contactOr: any[] = [];
    const userEmail = (workspace as any).email;
    const userPhone = (workspace as any).phone;
    if (userEmail) contactOr.push({ email: userEmail });
    if (userPhone) {
      const phoneVars = getBrazilianPhoneVariations(userPhone);
      if (phoneVars.length) contactOr.push({ phone: { in: phoneVars } });
    }
    if (contactOr.length) {
      connectionOr.push({
        AND: [
          { contact: { OR: contactOr } },
          { status: 'OPEN' },
        ],
      });
    }

    filterAnd.push({ OR: connectionOr });
    delete filter.whatsAppConnectionId;
  } else if (filterConnectionId && filterConnectionId !== 'all') {
    filter.whatsAppConnectionId = filterConnectionId;
  } else if (!filterConnectionId) {
    // Default for owner: show only their own conversations
    const ownerConnection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId, userId: workspace.id, provider: 'EVOLUTION' }
    });
    if (ownerConnection) {
      filter.whatsAppConnectionId = ownerConnection.id;
    }
  }

  const hasConnectionFilter = Boolean(filter.whatsAppConnectionId) || workspace.role !== 'owner';
  if (assignedToMe && !hasConnectionFilter) {
    filter.contact = { ...filter.contact, assignedUserId: workspace.id };
  }

  if (since && since !== 'undefined' && since !== 'null') {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      filterAnd.push({
        OR: [
          { updatedAt: { gt: sinceDate } },
          { lastMessageAt: { gt: sinceDate } },
          { contact: { updatedAt: { gt: sinceDate } } }
        ],
      });
    }
  }

  if (filterAnd.length > 0) {
    filter.AND = filterAnd;
  }

  const messageSelect: any = {
    id: true,
    direction: true,
    type: true,
    content: true,
    timestamp: true,
    isEdited: true,
    status: true,
    reactions: true,
    mediaStatus: true,
    mediaError: true,
    media: { select: { id: true } },
    transcript: {
      select: { text: true },
    },
  };

  const conversationInclude: any = {
    contact: {
      select: {
        name: true,
        company: true,
        email: true,
        interestArea: true,
        phone: true,
        origin: true,
        notes: true,
        productId: true,
        address: true,
        isLead: true,
        avatarUrl: true,
        assignedUserId: true,
        assignedUser: { select: { name: true } },
        contactProducts: {
          select: {
            id: true,
            productId: true,
            customName: true,
            customPrice: true,
            product: {
              select: { name: true, price: true },
            },
          },
        },
      },
    },
    messages: {
      orderBy: { timestamp: 'desc' },
      take: messageLimit,
      select: messageSelect,
    },
    _count: {
      select: { messages: true },
    },
  };

  if (includeAnalysis) {
    conversationInclude.analyses = {
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        createdAt: true,
        summary: true,
        stage: true,
        leadClassification: true,
        riskLevel: true,
        urgency: true,
        painPoints: true,
        explicitObjections: true,
        implicitObjections: true,
        buyingSignals: true,
        recommendedPosture: true,
        whatToAvoid: true,
        nextConcreteStep: true,
        timeWindow: true,
        suggestedReplies: {
          select: { type: true, content: true },
        },
      },
    };
  }

  const conversations = (await prisma.conversation.findMany({
    where: filter,
    take: 100,
    include: conversationInclude,
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
  })) as any[];

  const mapped = conversations.map((conversation) => {
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
      timestamp: time.toISOString(),
      msg: preview,
      status: normalizeTemperature(conversation.temperature),
      unread: 0,
      phone: conversation.contact.phone,
      email: conversation.contact.email,
      interestArea: conversation.contact.interestArea,
      origin: conversation.contact.origin || null,
      notes: conversation.contact.notes || null,
      productId: conversation.contact.productId || null,
      productIds: conversation.contact.contactProducts ? conversation.contact.contactProducts.map((cp: any) => cp.productId).filter(Boolean) : (conversation.contact.productId ? [conversation.contact.productId] : []),
      contactProducts: conversation.contact.contactProducts ? conversation.contact.contactProducts.map((cp: any) => ({
        id: cp.id,
        productId: cp.productId,
        customName: cp.customName,
        customPrice: cp.customPrice,
        originalPrice: cp.product?.price || null,
        name: cp.customName || cp.product?.name || "Sem Nome",
      })) : [],
      address: conversation.contact.address || null,
      isLead: conversation.contact.isLead,
      assignedUserId: conversation.contact.assignedUserId || null,
      assignedUserName: conversation.contact.assignedUser?.name || null,
      messageCount: conversation._count?.messages ?? conversation.messages.length,
      canReply: Boolean(
        (whatsappConnection?.provider === 'META' && whatsappConnection?.accessToken && whatsappConnection.phoneNumberId) ||
        (whatsappConnection?.provider === 'EVOLUTION' && whatsappConnection?.instanceName && whatsappConnection?.status === 'CONNECTED')
      ),
      avatarUrl: conversation.contact.avatarUrl,
      messages: conversation.messages.reverse().map((message: any) => ({
        id: message.id,
        direction: (message.direction === 'OUTBOUND' ? 'outbound' : 'inbound') as 'outbound' | 'inbound',
        type: message.type,
        text: formatConversationMessage(
          message.content,
          message.transcript?.text || null,
          message.type,
        ),
        content: message.content,
        mediaUrl: includeMediaUrls && isMediaMessageType(message.type) && message.media ? getMediaProxyUrl(message.id) : null,
        mediaStatus: isMediaMessageType(message.type) ? (message.media ? 'AVAILABLE' : message.mediaStatus) : 'NONE',
        mediaError: message.mediaError || null,
        time: new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(message.timestamp),
        timestamp: message.timestamp.toISOString(),
        isEdited: message.isEdited,
        status: message.status,
        reactions: message.reactions,
      })),
      latestAnalysis: conversation.analyses?.[0]
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
          timeWindow: conversation.analyses[0].timeWindow || '',
          suggestedReplies: mapSuggestedRepliesToObject(conversation.analyses[0].suggestedReplies),
        }
        : null,
    };
  });

  return {
    conversations: mapped,
    orgId,
    syncTime,
    connectionStatus: whatsappConnection?.status || "DISCONNECTED",
    connections: includeConnections && workspace.role === 'owner' ? mappedConnections : undefined,
  };
}

export async function getSettingsData(): Promise<SettingsData> {
  try {
    const workspace = await getCurrentWorkspace();
    const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';

    const [connections, promptTemplates, teamMembers] = await Promise.all([
      prisma.whatsAppConnection.findMany({
        where: {
          organizationId: workspace.organizationId,
          userId: workspace.id
        },
      }),
      prisma.promptTemplate.findMany({
        where: { organizationId: workspace.organizationId },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.user.findMany({
        where: { organizationId: workspace.organizationId },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' }
      })
    ]);

    const session = await auth();
    let currentUser = null;
    let googleOAuthUrl = '';

    if (session.userId) {
      currentUser = await prisma.user.findUnique({
        where: { clerkId: session.userId }
      });
      if (currentUser) {
        try {
          const { getGoogleOAuthUrl } = await import('@/lib/google-calendar');
          googleOAuthUrl = getGoogleOAuthUrl(currentUser.id);
        } catch (e) {
          console.warn("Google Calendar configuration missing or invalid:", e);
        }
      }
    }

    let metaConn = connections.find(c => c.provider === 'META');
    let evoConn = connections.find(c => c.provider === 'EVOLUTION');

    let activeConn = connections.find(c => c.isActive) || metaConn || evoConn;

    // Auto-heal active state: if we have connections but none is active, make one active in the DB
    if (connections.length > 0 && !connections.some(c => c.isActive)) {
      if (metaConn) {
        await prisma.whatsAppConnection.update({
          where: { id: metaConn.id },
          data: { isActive: true }
        });
        metaConn.isActive = true;
        activeConn = metaConn;
      } else if (evoConn) {
        await prisma.whatsAppConnection.update({
          where: { id: evoConn.id },
          data: { isActive: true }
        });
        evoConn.isActive = true;
        activeConn = evoConn;
      }
    }

    const formatConnection = (conn: typeof metaConn | undefined): WhatsAppConnectionSettings | null => {
      if (!conn) return null;
      return {
        id: conn.id,
        provider: conn.provider,
        instanceName: conn.instanceName,
        instanceToken: conn.instanceToken,
        phoneNumberId: conn.phoneNumberId || '',
        wabaId: conn.wabaId || '',
        hasAccessToken: Boolean(conn.accessToken || (conn.provider === 'META' && envWhatsAppToken)),
        status: conn.status,
      };
    };

    const formattedActive = formatConnection(activeConn) || {
      id: null,
      provider: 'META',
      instanceName: null,
      instanceToken: null,
      phoneNumberId: '',
      wabaId: '',
      hasAccessToken: Boolean(envWhatsAppToken),
      status: 'DISCONNECTED',
    };

    return {
      whatsappConnectionStatus: activeConn?.status || 'DISCONNECTED',
      whatsappLastSync: activeConn?.lastSyncAt ? formatDateTime(activeConn.lastSyncAt) : 'Nunca',
      whatsappConnection: formattedActive,
      whatsappConnectionMeta: formatConnection(metaConn),
      whatsappConnectionEvolution: formatConnection(evoConn),
      activeProvider: activeConn?.provider || 'META',
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
      googleCalendarStatus: Boolean(currentUser?.googleAccessToken),
      googleOAuthUrl: googleOAuthUrl,
      teamMembers: teamMembers,
      maxUsers: workspace.organization.maxUsers,
      currentMemberCount: teamMembers.length,
      currentUserRole: workspace.role,
      dealNotificationEmail: workspace.organization.dealNotificationEmail,
      masterclassNotificationEmail: workspace.organization.masterclassNotificationEmail,
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
      whatsappConnectionMeta: null,
      whatsappConnectionEvolution: null,
      activeProvider: 'META',
      openAIStatus: 'Erro no Banco',
      inngestStatus: errorMsg.includes('Prisma') ? 'Erro de Conexão Prisma' : 'Erro no Banco',
      promptTemplatesCount: 0,
      promptTemplates: [],
      googleCalendarStatus: false,
      googleOAuthUrl: '',
      teamMembers: [],
      maxUsers: 5,
      currentMemberCount: 1,
      currentUserRole: 'owner',
      dealNotificationEmail: null,
      masterclassNotificationEmail: null,
      errorMessage: errorMsg
    } as any;
  }
}

export async function shareContactMessage(contactId: string, targetConversationId: string) {
  const workspace = await ensurePaidWorkspace();

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      organizationId: workspace.organizationId
    }
  });

  if (!contact) {
    throw new Error("Contato não encontrado");
  }

  const cleanPhone = contact.phone.replace(/\D/g, "");
  let messageText = `👤 *Contato Compartilhado*\n*Nome:* ${contact.name}\n*Telefone:* ${contact.phone}`;
  if (contact.company) {
    messageText += `\n*Empresa:* ${contact.company}`;
  }
  messageText += `\n\n*Clique para iniciar conversa:* https://wa.me/${cleanPhone}`;

  return await sendConversationMessage(targetConversationId, messageText);
}

function getEvolutionErrorMessage(result: any) {
  return result?.response?.message || result?.message || JSON.stringify(result);
}

function isRetryableWhatsAppNumberError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  return normalized.includes('exists":false') ||
    normalized.includes('"exists": false') ||
    normalized.includes('exists:false') ||
    normalized.includes('not exists') ||
    normalized.includes('jid') && normalized.includes('exists');
}

async function sendEvolutionTextWithFallback(input: {
  instanceName: string;
  token: string;
  phone: string;
  text: string;
}) {
  const candidates = getOutboundWhatsAppNumberCandidates(input.phone);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const result = await evolution.sendText(input.instanceName, input.token, candidate, input.text);
      if (result.error || result.status === 500 || result.status === 400 || result.status === 404) {
        throw new Error(`Evolution API Error: ${getEvolutionErrorMessage(result)}`);
      }
      return { result, to: candidate };
    } catch (error) {
      lastError = error;
      if (!isRetryableWhatsAppNumberError(error)) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Evolution API Error: número inválido para WhatsApp.');
}

async function sendEvolutionMediaWithFallback(input: {
  instanceName: string;
  token: string;
  phone: string;
  base64: string;
  mediatype: string;
  mimetype: string;
  caption?: string;
  fileName?: string;
}) {
  const candidates = getOutboundWhatsAppNumberCandidates(input.phone);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const result = await evolution.sendMedia(
        input.instanceName,
        input.token,
        candidate,
        input.base64,
        input.mediatype,
        input.mimetype,
        input.caption || '',
        input.fileName,
      );
      if (result.error || result.status === 500 || result.status === 400 || result.status === 404) {
        throw new Error(`Evolution API Error: ${getEvolutionErrorMessage(result)}`);
      }
      return { result, to: candidate };
    } catch (error) {
      lastError = error;
      if (!isRetryableWhatsAppNumberError(error)) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Evolution API Error: número inválido para WhatsApp.');
}

function cleanOutboundMimeType(value: string) {
  const clean = value.split(';')[0]?.trim().toLowerCase();
  return clean || 'application/octet-stream';
}

function normalizeOutboundMediaType(mediatype: string, mimetype: string) {
  const media = mediatype.toLowerCase();
  if (['image', 'audio', 'video', 'document'].includes(media)) return media;
  const cleanMime = cleanOutboundMimeType(mimetype);
  if (cleanMime.startsWith('image/')) return 'image';
  if (cleanMime.startsWith('audio/')) return 'audio';
  if (cleanMime.startsWith('video/')) return 'video';
  return 'document';
}

function getOutboundMediaLabel(mediatype: string, fileName?: string) {
  if (mediatype === 'image') return 'Imagem';
  if (mediatype === 'video') return 'Vídeo';
  if (mediatype === 'audio') return 'Mensagem de áudio';
  return fileName || 'Documento';
}

function buildMetaMediaPayload(mediatype: string, mediaId: string, fileName?: string) {
  if (mediatype === 'image') return { type: 'image', image: { id: mediaId } };
  if (mediatype === 'video') return { type: 'video', video: { id: mediaId } };
  if (mediatype === 'audio') return { type: 'audio', audio: { id: mediaId } };
  return { type: 'document', document: { id: mediaId, filename: fileName || 'arquivo' } };
}

export async function sendConversationMessage(conversationId: string, content: string) {
  const workspace = await ensurePaidWorkspace();
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
      whatsAppConnection: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const contactPhone = conversation.contact?.phone;
  const contactEmail = conversation.contact?.email;
  const phoneVariations = contactPhone ? getBrazilianPhoneVariations(contactPhone) : [];
  const orClauses: Record<string, unknown>[] = [];
  if (contactEmail) orClauses.push({ email: contactEmail });
  if (phoneVariations.length) orClauses.push({ phone: { in: phoneVariations } });
  const isInternal = orClauses.length > 0
    ? !!(await prisma.user.findFirst({
        where: { organizationId: workspace.organizationId, OR: orClauses },
        select: { id: true },
      }))
    : false;

  let connection = conversation.whatsAppConnection;

  if (!connection || connection.status !== 'CONNECTED') {
    if (isInternal) {
      connection = await prisma.whatsAppConnection.findFirst({
        where: { organizationId: workspace.organizationId, userId: workspace.id, status: 'CONNECTED' },
      });
    }

    if (!connection) {
      throw new Error('WhatsApp connection is not configured or disconnected. Please reconnect your WhatsApp instance.');
    }
  }

  const isEvolution = connection.provider === 'EVOLUTION';
  const rawToken = isEvolution ? connection.instanceToken : (connection.accessToken || envWhatsAppToken);

  if (!rawToken) {
    throw new Error('WhatsApp connection is not configured for outbound messages');
  }
  const accessToken: string = rawToken;

  if (!isEvolution && !connection.phoneNumberId) {
    throw new Error('WhatsApp connection is not configured for outbound messages');
  }

  try {
    let response: any;
    let waMessageId: string | null = null;
    let sentTo = getOutboundWhatsAppNumber(conversation.contact.phone);

    if (isEvolution && connection.instanceName) {
      // Evolution API Logic
      const { decryptToken } = await import('@/lib/encryption');
      const decryptedToken = decryptToken(accessToken);

      const { result, to } = await sendEvolutionTextWithFallback({
        instanceName: connection.instanceName,
        token: decryptedToken,
        phone: conversation.contact.phone,
        text: trimmedContent,
      });

      response = result;
      sentTo = to;
      waMessageId = result.key?.id || result.message?.key?.id || null;
    } else if (connection?.phoneNumberId) {
      // Meta API Logic
      const result = await sendWhatsAppMessage(accessToken, {
        phoneNumberId: connection.phoneNumberId,
        to: sentTo,
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
        whatsAppConnectionId: connection.id,
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
        payload: { ...response, phoneOriginal: conversation.contact.phone, sentTo },
        statusCode: 200,
      },
    });



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
  const workspace = await ensurePaidWorkspace();
  const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const rawBase64 = input.base64.includes('base64,')
    ? input.base64.split('base64,')[1]
    : input.base64;
  const rawBase64Length = rawBase64.length;
  const buffer = Buffer.from(rawBase64, 'base64');
  const mediatype = normalizeOutboundMediaType(input.mediatype, input.mimetype);
  const mimetype = cleanOutboundMimeType(input.mimetype);
  const dbType = mediatype.toUpperCase();
  const fileName = input.fileName || (mediatype === 'document' ? 'arquivo' : `media.${mimetype.split('/')[1] || 'bin'}`);
  const content = getOutboundMediaLabel(mediatype, fileName);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: input.conversationId,
      contact: { organizationId: workspace.organizationId },
    },
    include: { contact: true },
  });

  if (!conversation) throw new Error('Conversation not found');

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      type: dbType,
      content,
      status: 'SENDING',
      mediaStatus: 'PROCESSING',
    },
  });

  try {
    await saveMessageMediaFromBase64({
      organizationId: workspace.organizationId,
      messageId: message.id,
      base64: rawBase64,
      mimeType: mimetype,
      originalFileName: fileName,
    });
  } catch (storageError) {
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: 'FAILED',
        mediaStatus: 'FAILED',
        mediaError: storageError instanceof Error ? storageError.message : 'Failed to store outbound media',
      },
    }).catch(() => null);
    throw storageError;
  }

  const contactPhone2 = conversation.contact?.phone;
  const contactEmail2 = conversation.contact?.email;
  const phoneVars2 = contactPhone2 ? getBrazilianPhoneVariations(contactPhone2) : [];
  const orClauses2: Record<string, unknown>[] = [];
  if (contactEmail2) orClauses2.push({ email: contactEmail2 });
  if (phoneVars2.length) orClauses2.push({ phone: { in: phoneVars2 } });
  const isInternal = orClauses2.length > 0
    ? !!(await prisma.user.findFirst({
        where: { organizationId: workspace.organizationId, OR: orClauses2 },
        select: { id: true },
      }))
    : false;

  let connection = conversation.whatsAppConnectionId
    ? await prisma.whatsAppConnection.findUnique({ where: { id: conversation.whatsAppConnectionId } })
    : null;

  if (!connection || connection.status !== 'CONNECTED') {
    if (isInternal) {
      connection = await prisma.whatsAppConnection.findFirst({
        where: { organizationId: workspace.organizationId, userId: workspace.id, status: 'CONNECTED' },
      });
    }

    if (!connection) {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', mediaError: 'WhatsApp connection is not configured for outbound messages' },
      }).catch(() => null);
      throw new Error('WhatsApp connection is not configured or disconnected. Please reconnect your WhatsApp instance.');
    }
  }

  const isEvolution = connection.provider === 'EVOLUTION';
  const rawToken = isEvolution ? connection.instanceToken : (connection.accessToken || envWhatsAppToken);

  if (!rawToken) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'FAILED', mediaError: 'WhatsApp connection is not configured for outbound media' },
    }).catch(() => null);
    throw new Error('WhatsApp connection is not configured for outbound media');
  }
  const accessToken: string = rawToken;
  let sentTo = getOutboundWhatsAppNumber(conversation.contact.phone);

  try {
    let response: any;
    let waMessageId: string | null = null;
    let waMessageKey: any = null;

    if (isEvolution) {
      if (!connection.instanceName) {
        throw new Error('Evolution instance is not configured for outbound media');
      }
      const { decryptToken } = await import('@/lib/encryption');
      const decryptedToken = decryptToken(accessToken);
      const { result, to } = await sendEvolutionMediaWithFallback({
        instanceName: connection.instanceName,
        token: decryptedToken,
        phone: conversation.contact.phone,
        base64: rawBase64,
        mediatype,
        mimetype,
        caption: mediatype === 'document' ? '' : '',
        fileName,
      });
      response = result;
      sentTo = to;
      waMessageId = result.key?.id || result.message?.key?.id || null;
      waMessageKey = result.key || result.message?.key || null;
    } else {
      if (!connection.phoneNumberId) {
        throw new Error('Meta phone number ID is not configured for outbound media');
      }
      const mediaId = await uploadWhatsAppMedia(accessToken, {
        phoneNumberId: connection.phoneNumberId,
        buffer,
        mimeType: mimetype,
        fileName,
      });
      const mediaPayload = buildMetaMediaPayload(mediatype, mediaId, fileName);
      const result = await sendWhatsAppMessage(accessToken, {
        phoneNumberId: connection.phoneNumberId,
        to: sentTo,
        ...(mediaPayload as any),
      });
      response = { mediaId, result };
      waMessageId = result?.messages?.[0]?.id || null;
    }

    let savedMessage;
    const existingWebhookMessage = waMessageId ? await prisma.message.findUnique({
      where: { waMessageId },
      select: { id: true },
    }) : null;

    if (existingWebhookMessage && existingWebhookMessage.id !== message.id) {
      await prisma.media.updateMany({ where: { messageId: message.id }, data: { messageId: existingWebhookMessage.id } }).catch(() => null);
      savedMessage = await prisma.message.update({
        where: { id: existingWebhookMessage.id },
        data: {
          type: dbType,
          content,
          direction: 'OUTBOUND',
          waMessageKey,
          status: 'SENT',
          mediaStatus: 'AVAILABLE',
          mediaError: null,
          whatsAppConnectionId: connection.id,
        },
      });
      await prisma.message.delete({ where: { id: message.id } }).catch(() => null);
    } else {
      savedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          waMessageId,
          waMessageKey,
          status: 'SENT',
          mediaStatus: 'AVAILABLE',
          mediaError: null,
          whatsAppConnectionId: connection.id,
        },
      });
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: savedMessage.timestamp },
    });

    await prisma.integrationLog.create({
      data: {
        connectionId: connection.id,
        event: 'OUTBOUND_MEDIA_SEND',
        direction: 'OUTBOUND',
        payload: {
          provider: connection.provider,
          phoneOriginal: conversation.contact.phone,
          sentTo,
          mediatype,
          mimetype,
          fileName,
          fileSize: buffer.byteLength,
          base64Bytes: rawBase64Length,
          response,
        },
        statusCode: 200,
      },
    });

    return {
      id: savedMessage.id,
      direction: 'outbound' as const,
      type: dbType,
      text: content,
      content,
      mediaUrl: getMediaProxyUrl(savedMessage.id),
      mediaStatus: 'AVAILABLE',
      mediaError: null,
      status: 'SENT',
      time: new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', minute: '2-digit',
      }).format(savedMessage.timestamp),
      timestamp: savedMessage.timestamp.toISOString(),
    };
  } catch (error) {
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: 'FAILED',
        mediaError: error instanceof Error ? error.message : 'Unknown media send error',
      },
    }).catch(() => null);

    await prisma.integrationLog.create({
      data: {
        connectionId: connection.id,
        event: 'OUTBOUND_MEDIA_ERROR',
        direction: 'OUTBOUND',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        payload: {
          conversationId: input.conversationId,
          provider: connection.provider,
          phoneOriginal: conversation.contact.phone,
          sentTo,
          mediatype,
          mimetype,
          fileName,
          fileSize: buffer.byteLength,
          base64Bytes: rawBase64Length,
        },
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
  const workspace = await ensurePaidWorkspace();
  const envWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const phoneNumberId = input.phoneNumberId?.trim() || '';
  const wabaId = input.wabaId?.trim() || '';
  const providedToken = input.accessToken?.trim() || '';

  const existingConnection = await prisma.whatsAppConnection.findFirst({
    where: {
      organizationId: workspace.organizationId,
      provider: 'META',
    },
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
        provider: 'META',
      },
    })
    : await prisma.whatsAppConnection.create({
      data: {
        organizationId: workspace.organizationId,
        provider: 'META',
        phoneNumberId: phoneNumberId || null,
        wabaId: wabaId || null,
        accessToken: nextToken,
        status: nextStatus,
        isActive: true,
      },
    });

  revalidatePath('/settings');

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
  const workspace = await ensurePaidWorkspace();
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
  const workspace = await ensurePaidWorkspace();

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
  const workspace = await ensurePaidWorkspace();

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
  const workspace = await ensurePaidWorkspace();

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

  // --- AUTO-UPDATE: Temperature & Stage from AI classification ---
  const classificationToTemperature: Record<string, string> = {
    LEAD_FRIO: 'COLD',
    LEAD_MORNO: 'WARM',
    LEAD_QUENTE: 'HOT',
    CLIENTE_NEGOCIACAO: 'HOT',
    CLIENTE_TRAVADO: 'WARM',
    CLIENTE_PERDIDO: 'COLD',
    CLIENTE_FECHADO: 'HOT',
  };

  const newTemperature = classificationToTemperature[input.analysis.leadClassification] || conversation.temperature;
  const newStage = input.analysis.stage || conversation.stage;

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      temperature: newTemperature,
      stage: newStage,
    },
  });




  return created;
}

export async function promoteToLead(contactId: string) {
  const workspace = await ensurePaidWorkspace();

  const contact = await prisma.contact.update({
    where: {
      id: contactId,
      organizationId: workspace.organizationId
    },
    data: { isLead: true }
  });

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { organizationId: workspace.organizationId },
    orderBy: { order: 'asc' },
  });
  const defaultStage = firstStage ? firstStage.name : "PRIMEIRO_CONTATO";

  // Encontra a conversa ativa do contato e reseta o estágio dela
  const conversation = await prisma.conversation.findFirst({
    where: { contactId: contactId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });

  let newStage = defaultStage;
  if (conversation) {
    const updatedConvo = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { stage: defaultStage },
    });
    newStage = updatedConvo.stage;
  }

  return { contact, stage: newStage };
}

export async function updateContactNotes(contactId: string, notes: string) {
  const workspace = await ensurePaidWorkspace();
  const contact = await prisma.contact.update({
    where: {
      id: contactId,
      organizationId: workspace.organizationId
    },
    data: { notes }
  });

  return contact;
}

export async function updateAnalysis(analysisId: string, data: Partial<AnalysisResponse>) {
  const workspace = await ensurePaidWorkspace();

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
      timeWindow: data.timeWindow,
      recommendedPosture: data.recommendedPosture,
      whatToAvoid: data.whatToAvoid,
    }
  });


  return updated;
}

// ============================================
// MESSAGE MANAGEMENT ACTIONS
// ============================================

export async function deleteOutboundMessage(messageId: string, conversationId: string) {
  const workspace = await ensurePaidWorkspace();

  const message = await prisma.message.findFirst({
    where: { id: messageId, direction: 'OUTBOUND', conversation: { contact: { organizationId: workspace.organizationId } } },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) throw new Error("Message not found");

  let connection = null;
  if (message.conversation.whatsAppConnectionId) {
    connection = await prisma.whatsAppConnection.findUnique({
      where: { id: message.conversation.whatsAppConnectionId }
    });
  }
  if (!connection) {
    connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: workspace.organizationId, userId: workspace.id, provider: 'EVOLUTION', status: 'CONNECTED' },
    });
  }

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

  return { success: true };
}

export async function editOutboundMessage(messageId: string, newText: string) {
  const workspace = await ensurePaidWorkspace();

  const message = await prisma.message.findFirst({
    where: { id: messageId, direction: 'OUTBOUND', conversation: { contact: { organizationId: workspace.organizationId } } },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) throw new Error("Message not found");

  let connection = null;
  if (message.conversation?.whatsAppConnectionId) {
    connection = await prisma.whatsAppConnection.findUnique({
      where: { id: message.conversation.whatsAppConnectionId }
    });
  }
  if (!connection) {
    connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: workspace.organizationId, userId: workspace.id, provider: 'EVOLUTION', status: 'CONNECTED' },
    });
  }

  if (connection?.instanceName && connection.instanceToken && message.waMessageId) {
    try {
      const { decryptToken } = await import('@/lib/encryption');
      const token = decryptToken(connection.instanceToken);
      await evolution.editMessage(connection.instanceName, token, message.conversation.contact.phone, message.waMessageId, newText);
    } catch (e) {
      console.warn('Failed to edit on WhatsApp:', e);
    }
  }

  const updated = await prisma.message.update({ where: { id: messageId }, data: { content: newText, isEdited: true } });

  return updated;
}

export async function sendMessageReaction(conversationId: string, messageId: string, emoji: string) {
  const workspace = await ensurePaidWorkspace();

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversation: { contact: { organizationId: workspace.organizationId } } },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) throw new Error("Message not found");

  let connection = null;
  if (message.conversation?.whatsAppConnectionId) {
    connection = await prisma.whatsAppConnection.findUnique({
      where: { id: message.conversation.whatsAppConnectionId }
    });
  }
  if (!connection) {
    connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: workspace.organizationId, userId: workspace.id, provider: 'EVOLUTION', status: 'CONNECTED' },
    });
  }

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

  // Update DB reactions local state immediately and revalidate path
  await prisma.message.update({
    where: { id: messageId },
    data: {
      reactions: emoji ? { [emoji]: Date.now() } : {}
    }
  });


  return { success: true };
}

// ============================================
// WHATSAPP PROFILE MANAGEMENT
// ============================================

export async function getWhatsAppProfile() {
  const workspace = await ensurePaidWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, userId: workspace.id, provider: 'EVOLUTION', status: 'CONNECTED' },
  });

  if (!connection?.instanceName || !connection.instanceToken) {
    return null;
  }

  try {
    const { decryptToken } = await import('@/lib/encryption');
    const token = decryptToken(connection.instanceToken);

    // Fetch instance status first to get connected phone number (owner JID)
    let phone: string | undefined = undefined;
    try {
      const statusData = await evolution.getInstanceStatus(connection.instanceName, token);
      const ownerJid = statusData?.instance?.owner || statusData?.owner;
      if (ownerJid) {
        phone = ownerJid.split('@')[0];
      }

      // Dynamic healing in getWhatsAppProfile
      const evolutionState = statusData?.instance?.state || statusData?.state;
      const isLiveConnected = evolutionState === 'open' || evolutionState === 'CONNECTED';
      if (isLiveConnected && connection.status !== 'CONNECTED') {
        await prisma.whatsAppConnection.update({
          where: { id: connection.id },
          data: { status: 'CONNECTED', lastConnectedAt: new Date() }
        });
        console.log(`[DYNAMIC HEAL PROFILE] Updated status to CONNECTED for ${connection.instanceName}`);
      }
    } catch (statusError) {
      console.warn('Could not determine connected owner phone number:', statusError);
    }

    const profile = await evolution.fetchProfile(connection.instanceName, token, phone);

    // Return a standardized object compatible with the React state expectations
    return {
      name: profile?.profileName || profile?.name || '',
      status: profile?.status || '',
      picture: profile?.profilePicUrl || profile?.picture || null
    };
  } catch (e) {
    console.warn('Failed to fetch WhatsApp profile:', e);
    return null;
  }
}

export async function updateWhatsAppProfile(data: { name?: string; status?: string; pictureBase64?: string }) {
  const workspace = await ensurePaidWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, userId: workspace.id, provider: 'EVOLUTION', status: 'CONNECTED' },
  });

  if (!connection?.instanceName || !connection.instanceToken) {
    throw new Error("WhatsApp not connected");
  }

  const { decryptToken } = await import('@/lib/encryption');
  const instanceName = connection.instanceName;
  const token = decryptToken(connection.instanceToken);
  const results: Record<string, unknown> = {};

  if (data.name) {
    results.name = await evolution.updateProfileName(instanceName, token, data.name);
  }
  if (data.status) {
    results.status = await evolution.updateProfileStatus(instanceName, token, data.status);
  }
  if (data.pictureBase64) {
    results.picture = await evolution.updateProfilePicture(instanceName, token, data.pictureBase64);
  }

  return results;
}

export async function getContactProfile(contactPhone: string) {
  const workspace = await ensurePaidWorkspace();
  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: workspace.organizationId, userId: workspace.id, provider: 'EVOLUTION', status: 'CONNECTED' },
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
  const workspace = await ensurePaidWorkspace();
  let stages = await prisma.pipelineStage.findMany({
    where: { organizationId: workspace.organizationId },
    orderBy: { order: 'asc' },
  });

  if (stages.length === 0) {
    const defaultStages = [
      { name: "Primeiro Contato", color: "bg-zinc-500" },
      { name: "Qualificação", color: "bg-blue-500" },
      { name: "Proposta", color: "bg-indigo-500" },
      { name: "Negociação", color: "bg-amber-500" },
      { name: "Objeção", color: "bg-red-500" },
      { name: "Follow-up", color: "bg-purple-500" },
      { name: "Fechamento", color: "bg-emerald-500" },
      { name: "Reativação", color: "bg-zinc-500" },
    ];

    // Seed stages
    for (let i = 0; i < defaultStages.length; i++) {
      await prisma.pipelineStage.create({
        data: {
          organizationId: workspace.organizationId,
          name: defaultStages[i].name,
          color: defaultStages[i].color,
          order: i,
        },
      });
    }

    // Migrate any legacy conversations referencing old keys to new friendly names
    const legacyMigration: Record<string, string> = {
      PRIMEIRO_CONTATO: "Primeiro Contato",
      QUALIFICACAO: "Qualificação",
      APRESENTACAO_PROPOSTA: "Proposta",
      NEGOCIACAO: "Negociação",
      OBJECAO: "Objeção",
      FOLLOW_UP: "Follow-up",
      FECHAMENTO: "Fechamento",
      REATIVACAO: "Reativação",
    };

    for (const [oldKey, newName] of Object.entries(legacyMigration)) {
      await prisma.conversation.updateMany({
        where: {
          stage: oldKey,
          contact: { organizationId: workspace.organizationId },
        },
        data: {
          stage: newName,
        },
      });
    }

    // Re-query
    stages = await prisma.pipelineStage.findMany({
      where: { organizationId: workspace.organizationId },
      orderBy: { order: 'asc' },
    });
  }

  return stages;
}

export async function getProducts(): Promise<ProductData[]> {
  const workspace = await ensurePaidWorkspace();
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
  productId?: string | null;
  productIds?: string[];
  notes?: string;
  origin?: string | null;
  potentialValue?: number | null;
  interestArea?: string | null;
}) {
  const workspace = await ensurePaidWorkspace();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: workspace.organizationId },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  const { productIds, ...contactData } = data;

  let updated;
  if (productIds !== undefined) {
    const existingCPs = await prisma.contactProduct.findMany({
      where: { contactId: contact.id }
    });

    const catalogCPs = existingCPs.filter(cp => cp.productId !== null);

    const toDeleteIds = catalogCPs
      .filter(cp => !productIds.includes(cp.productId!))
      .map(cp => cp.id);

    const existingCatalogProductIds = catalogCPs.map(cp => cp.productId!);
    const toAddProductIds = productIds.filter(pid => !existingCatalogProductIds.includes(pid));

    contactData.productId = productIds.length > 0 ? productIds[0] : null;

    updated = await prisma.contact.update({
      where: { id: contact.id },
      data: contactData,
    });

    if (toDeleteIds.length > 0) {
      await prisma.contactProduct.deleteMany({
        where: { id: { in: toDeleteIds } }
      });
    }

    if (toAddProductIds.length > 0) {
      await prisma.contactProduct.createMany({
        data: toAddProductIds.map(pid => ({
          contactId: contact.id,
          productId: pid
        }))
      });
    }
  } else {
    updated = await prisma.contact.update({
      where: { id: contact.id },
      data: contactData,
    });
  }

  await updatePotentialValue(contact.id);



  return updated;
}

export async function addCustomProductToContact(contactId: string, name: string, price: number) {
  const workspace = await ensurePaidWorkspace();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: workspace.organizationId },
  });
  if (!contact) throw new Error('Contact not found');

  const cp = await prisma.contactProduct.create({
    data: {
      contactId,
      customName: name,
      customPrice: price,
    },
    include: {
      product: true,
    }
  });

  await updatePotentialValue(contactId);



  return cp;
}

export async function addCatalogProductToContact(contactId: string, productId: string) {
  const workspace = await ensurePaidWorkspace();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: workspace.organizationId },
  });
  if (!contact) throw new Error('Contact not found');

  const cp = await prisma.contactProduct.create({
    data: {
      contactId,
      productId,
    },
    include: {
      product: true,
    }
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: { productId: productId }
  });

  await updatePotentialValue(contactId);



  return cp;
}

export async function updateContactProductPrice(contactProductId: string, customPrice: number | null) {
  const workspace = await ensurePaidWorkspace();

  const cp = await prisma.contactProduct.findFirst({
    where: {
      id: contactProductId,
      contact: { organizationId: workspace.organizationId }
    }
  });
  if (!cp) throw new Error('Contact product not found');

  const updated = await prisma.contactProduct.update({
    where: { id: contactProductId },
    data: { customPrice },
    include: { product: true }
  });

  await updatePotentialValue(cp.contactId);



  return updated;
}

export async function removeContactProduct(contactProductId: string) {
  const workspace = await ensurePaidWorkspace();

  const cp = await prisma.contactProduct.findFirst({
    where: {
      id: contactProductId,
      contact: { organizationId: workspace.organizationId }
    }
  });
  if (!cp) throw new Error('Contact product not found');

  await prisma.contactProduct.delete({
    where: { id: contactProductId }
  });

  const remaining = await prisma.contactProduct.findFirst({
    where: { contactId: cp.contactId, productId: { not: null } }
  });
  await prisma.contact.update({
    where: { id: cp.contactId },
    data: { productId: remaining?.productId || null }
  });

  await updatePotentialValue(cp.contactId);



  return { success: true };
}

async function updatePotentialValue(contactId: string) {
  const contactProducts = await prisma.contactProduct.findMany({
    where: { contactId },
    include: { product: true }
  });

  const total = contactProducts.reduce((sum, cp) => {
    const price = cp.customPrice !== null ? cp.customPrice : (cp.product?.price || 0);
    return sum + price;
  }, 0);

  await prisma.contact.update({
    where: { id: contactId },
    data: { potentialValue: total }
  });
}

export async function suggestChallengesFromAI(contactId: string) {
  const workspace = await ensurePaidWorkspace();

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

// --- PRODUCT CRUD ACTIONS ---
export async function createProduct(data: { name: string; price: number | null; description: string | null }) {
  const workspace = await ensurePaidWorkspace();
  const newProduct = await prisma.product.create({
    data: {
      organizationId: workspace.organizationId,
      name: data.name,
      price: data.price,
      description: data.description,
      isActive: true,
    },
  });


  return newProduct;
}

export async function updateProduct(id: string, data: { name?: string; price?: number | null; description?: string | null; isActive?: boolean }) {
  const workspace = await ensurePaidWorkspace();
  const updated = await prisma.product.update({
    where: { id, organizationId: workspace.organizationId },
    data,
  });


  return updated;
}

export async function deleteProduct(id: string) {
  const workspace = await ensurePaidWorkspace();
  // Soft delete by setting isActive = false
  const deleted = await prisma.product.update({
    where: { id, organizationId: workspace.organizationId },
    data: { isActive: false },
  });


  return deleted;
}

// --- LEAD ORIGIN CRUD ACTIONS ---
export async function getLeadOrigins() {
  const workspace = await ensurePaidWorkspace();
  return prisma.leadOrigin.findMany({
    where: { organizationId: workspace.organizationId },
    orderBy: { name: 'asc' },
  });
}

export async function createLeadOrigin(name: string) {
  const workspace = await ensurePaidWorkspace();
  const origin = await prisma.leadOrigin.create({
    data: {
      organizationId: workspace.organizationId,
      name,
    },
  });


  return origin;
}

export async function updateLeadOrigin(id: string, name: string) {
  const workspace = await ensurePaidWorkspace();
  const updated = await prisma.leadOrigin.update({
    where: { id, organizationId: workspace.organizationId },
    data: { name },
  });


  return updated;
}

export async function deleteLeadOrigin(id: string) {
  const workspace = await ensurePaidWorkspace();
  const deleted = await prisma.leadOrigin.delete({
    where: { id, organizationId: workspace.organizationId },
  });


  return deleted;
}

export async function startNewConversation(name: string, phone: string, initialMessage?: string) {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  // Clean phone number (leave only numbers)
  const cleanPhone = phone.replace(/\D/g, '');

  if (!cleanPhone) {
    throw new Error('Número de telefone inválido.');
  }

  const contactResolution = await resolveOrCreateContact({
    organizationId: orgId,
    phone: cleanPhone,
    name,
    assignedUserId: workspace.id,
    source: 'Nova conversa manual',
  });
  const contact = contactResolution.contact;

  // Find user's WhatsApp connection regardless of status, fallback to any organization connection
  const userConnection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId, userId: workspace.id }
  }) || await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId }
  });

  const conversation = await resolveOpenConversation({
    contactId: contact.id,
    whatsAppConnectionId: userConnection?.id || null,
    stage: 'PRIMEIRO_CONTATO',
    temperature: 'COLD',
    lastMessageAt: new Date(),
    replaceConnection: true,
  });

  // Send initial message if provided
  if (initialMessage && initialMessage.trim()) {
    await sendConversationMessage(conversation.id, initialMessage.trim());
  }

  revalidatePath('/contacts');
  revalidatePath('/conversations');

  return {
    success: true,
    conversationId: conversation.id,
  };
}

export async function createLead(data: {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  origin?: string;
  productId?: string;
  temperature?: string;
  assignedUserId?: string;
  stage?: string;
}) {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  const cleanPhone = data.phone.replace(/\D/g, '');
  if (!cleanPhone) {
    throw new Error('Número de telefone inválido.');
  }

  const existingContact = await prisma.contact.findFirst({
    where: {
      organizationId: orgId,
      phone: { in: getBrazilianPhoneVariations(cleanPhone) }
    }
  });

  let contact;
  if (existingContact) {
    contact = await prisma.contact.update({
      where: { id: existingContact.id },
      data: {
        name: data.name,
        isLead: true,
        email: data.email || existingContact.email,
        company: data.company || existingContact.company,
        origin: data.origin || existingContact.origin,
        productId: data.productId || existingContact.productId,
        assignedUserId: data.assignedUserId || existingContact.assignedUserId || workspace.id
      }
    });
  } else {
    contact = await prisma.contact.create({
      data: {
        phone: cleanPhone,
        name: data.name,
        isLead: true,
        email: data.email || null,
        company: data.company || null,
        origin: data.origin || null,
        productId: data.productId || null,
        assignedUserId: data.assignedUserId || workspace.id,
        organizationId: orgId
      }
    });
  }

  const userConnection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId, userId: workspace.id }
  }) || await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId }
  });

  const targetStage = data.stage || 'Primeiro Contato';
  const targetTemp = data.temperature || 'COLD';
  let conversation = await resolveOpenConversation({
    contactId: contact.id,
    whatsAppConnectionId: userConnection?.id || null,
    stage: targetStage,
    temperature: targetTemp,
    lastMessageAt: new Date(),
    replaceConnection: true,
  });

  if (conversation.stage !== targetStage || conversation.temperature !== targetTemp) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { stage: targetStage, temperature: targetTemp },
    });
  }

  revalidatePath('/contacts');
  revalidatePath('/conversations');

  return {
    success: true,
    leadId: contact.id,
    conversationId: conversation.id
  };
}

export async function createPipelineStage(name: string, color: string = "bg-zinc-500") {
  const workspace = await ensurePaidWorkspace();
  const stagesCount = await prisma.pipelineStage.count({
    where: { organizationId: workspace.organizationId },
  });

  const newStage = await prisma.pipelineStage.create({
    data: {
      organizationId: workspace.organizationId,
      name,
      color,
      order: stagesCount,
    },
  });



  return newStage;
}

export async function updatePipelineStage(id: string, data: { name?: string; color?: string; visible?: boolean }) {
  const workspace = await ensurePaidWorkspace();

  const oldStage = await prisma.pipelineStage.findFirst({
    where: { id, organizationId: workspace.organizationId }
  });

  const updated = await prisma.pipelineStage.update({
    where: { id, organizationId: workspace.organizationId },
    data,
  });

  if (oldStage && data.name && oldStage.name !== data.name) {
    await prisma.conversation.updateMany({
      where: {
        stage: oldStage.name,
        contact: { organizationId: workspace.organizationId }
      },
      data: {
        stage: data.name
      }
    });
  }



  return updated;
}

export async function deletePipelineStage(id: string, migrateToStageName?: string) {
  const workspace = await ensurePaidWorkspace();

  const oldStage = await prisma.pipelineStage.findFirst({
    where: { id, organizationId: workspace.organizationId }
  });

  if (!oldStage) {
    throw new Error("Stage not found");
  }

  // Delete the stage from database
  const deleted = await prisma.pipelineStage.delete({
    where: { id, organizationId: workspace.organizationId },
  });

  // Load and re-order remaining stages
  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId: workspace.organizationId },
    orderBy: { order: 'asc' },
  });

  for (let i = 0; i < stages.length; i++) {
    await prisma.pipelineStage.update({
      where: { id: stages[i].id },
      data: { order: i },
    });
  }

  // Migrate any conversations belonging to the deleted stage name
  const targetStage = migrateToStageName || stages[0]?.name;
  if (targetStage && oldStage.name) {
    await prisma.conversation.updateMany({
      where: {
        stage: oldStage.name,
        contact: { organizationId: workspace.organizationId }
      },
      data: {
        stage: targetStage
      }
    });
  }



  return deleted;
}

export async function reorderPipelineStages(stageIds: string[]) {
  const workspace = await ensurePaidWorkspace();

  for (let i = 0; i < stageIds.length; i++) {
    await prisma.pipelineStage.update({
      where: { id: stageIds[i], organizationId: workspace.organizationId },
      data: { order: i },
    });
  }



  return { success: true };
}



export async function deleteLead(leadId: string) {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  // Validate contact belongs to organization
  const contact = await prisma.contact.findFirst({
    where: { id: leadId, organizationId: orgId }
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  // Delete tasks referencing this contact first to prevent foreign key errors
  await prisma.task.deleteMany({
    where: { contactId: leadId }
  });

  // Cascade delete cleans up conversations, messages, histories
  const deleted = await prisma.contact.delete({
    where: { id: leadId }
  });




  return deleted;
}

export async function registerPendingPayment(email: string, plan: string) {
  const cleanEmail = email.toLowerCase().trim();
  const updated = await prisma.pendingPayment.upsert({
    where: { email: cleanEmail },
    update: { plan, paid: true },
    create: { email: cleanEmail, plan, paid: true },
  });
  return updated;
}

export async function setActiveWhatsAppProvider(provider: 'META' | 'EVOLUTION') {
  const workspace = await ensurePaidWorkspace();

  // 1. Deactivate other connections
  await prisma.whatsAppConnection.updateMany({
    where: {
      organizationId: workspace.organizationId,
      userId: workspace.id,
      provider: { not: provider },
    },
    data: {
      isActive: false,
    },
  });

  // 2. Activate connection of this provider
  const existing = await prisma.whatsAppConnection.findFirst({
    where: {
      organizationId: workspace.organizationId,
      userId: workspace.id,
      provider,
    },
  });

  if (existing) {
    await prisma.whatsAppConnection.update({
      where: { id: existing.id },
      data: {
        isActive: true,
      },
    });
  } else {
    await prisma.whatsAppConnection.create({
      data: {
        organizationId: workspace.organizationId,
        userId: workspace.id,
        provider,
        isActive: true,
        status: 'DISCONNECTED',
      },
    });
  }

  revalidatePath('/settings');

  return { success: true };
}

export async function getScheduledMessages(conversationId: string) {
  const workspace = await ensurePaidWorkspace();
  return prisma.scheduledMessage.findMany({
    where: {
      conversationId,
      status: 'PENDING',
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  });
}

export async function scheduleMessages(conversationId: string, messages: Array<{ content: string; scheduledFor: Date }>, clearQueue: boolean = true) {
  const workspace = await ensurePaidWorkspace();

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      contact: { organizationId: workspace.organizationId },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // 1. Delete existing pending scheduled messages to clear previous queue if requested
  if (clearQueue) {
    await prisma.scheduledMessage.deleteMany({
      where: {
        conversationId,
        status: 'PENDING',
      },
    });
  }

  // 2. Create new scheduled messages and register them with Inngest
  const { inngest } = await import('@/inngest/client');
  for (const msg of messages) {
    const scheduled = await prisma.scheduledMessage.create({
      data: {
        conversationId,
        content: msg.content,
        scheduledFor: msg.scheduledFor,
        status: 'PENDING',
      },
    });

    await inngest.send({
      name: 'message/scheduled-dispatch',
      data: {
        scheduledMessageId: scheduled.id,
      },
    });
  }


  return { success: true };
}

export async function cancelScheduledMessage(scheduledMessageId: string) {
  const workspace = await ensurePaidWorkspace();

  const updated = await prisma.scheduledMessage.updateMany({
    where: {
      id: scheduledMessageId,
      conversation: {
        contact: { organizationId: workspace.organizationId }
      }
    },
    data: { status: 'CANCELLED' }
  });

  if (updated.count === 0) {
    throw new Error('Message not found or not authorized');
  }


  return { success: true };
}

export async function getUnnotifiedScheduledMessages() {
  const workspace = await ensurePaidWorkspace();
  return prisma.scheduledMessage.findMany({
    where: {
      status: 'SENT',
      notified: false,
      conversation: {
        contact: { organizationId: workspace.organizationId },
      },
    },
    include: {
      conversation: {
        include: {
          contact: true,
        },
      },
    },
  });
}

export async function markScheduledMessagesAsNotified(ids: string[]) {
  const workspace = await ensurePaidWorkspace();
  await prisma.scheduledMessage.updateMany({
    where: {
      id: { in: ids },
      conversation: {
        contact: { organizationId: workspace.organizationId },
      },
    },
    data: {
      notified: true,
    },
  });
  return { success: true };
}


export async function forwardMessages(sourceMessageIds: string[], targetConversationId: string) {
  const workspace = await ensurePaidWorkspace();

  const targetConversation = await prisma.conversation.findFirst({
    where: {
      id: targetConversationId,
      contact: { organizationId: workspace.organizationId },
    },
    include: { contact: true },
  });

  if (!targetConversation) throw new Error('Target conversation not found');

  const messagesToForward = await prisma.message.findMany({
    where: {
      id: { in: sourceMessageIds },
      conversation: { contact: { organizationId: workspace.organizationId } },
    },
    include: { media: true },
    orderBy: { timestamp: 'asc' }
  });

  if (messagesToForward.length === 0) return { success: true };

  let successCount = 0;

  for (const msg of messagesToForward) {
    try {
      if (msg.type === 'TEXT') {
        const text = `*Encaminhada*\n${msg.content || ''}`;
        await sendConversationMessage(targetConversation.id, text);
        successCount++;
      } else if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'].includes(msg.type)) {
        const legacyMedia = msg.mediaUrl?.startsWith('data:') ? normalizeBase64Media(msg.mediaUrl) : null;
        const base64 = msg.media
          ? await readStoredMediaBase64(msg.media.storageKey)
          : legacyMedia?.base64;
        const mimetype = cleanOutboundMimeType(msg.media?.mimeType || legacyMedia?.mimeType || 'application/octet-stream');

        if (base64) {
          let mediatype = msg.type.toLowerCase();
          mediatype = normalizeOutboundMediaType(mediatype, mimetype);

          await sendMediaMessage({
            conversationId: targetConversation.id,
            base64,
            mediatype,
            mimetype,
            fileName: msg.media?.originalFileName || 'encaminhado',
          });
          successCount++;
        }
      }
    } catch (err) {
      console.error(`Failed to forward message ${msg.id}:`, err);
    }
  }

  if (successCount > 0) {
    await prisma.conversation.update({
      where: { id: targetConversation.id },
      data: { lastMessageAt: new Date() },
    });
  }

  return { success: true, forwardedCount: successCount };
}

export async function syncAfterReconnect() {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  const connection = await prisma.whatsAppConnection.findFirst({
    where: {
      organizationId: orgId,
      userId: workspace.id,
      provider: 'EVOLUTION',
      status: 'CONNECTED'
    },
  });

  if (!connection || !connection.instanceName || !connection.instanceToken) {
    return { success: false, reason: 'No active evolution connection' };
  }

  const { decryptToken } = await import('@/lib/encryption');
  const instanceName = connection.instanceName;
  const token = decryptToken(connection.instanceToken);

  let newMessagesCount = 0;

  try {
    const chats = await evolution.findChats(instanceName, token);

    const recentChats = chats.slice(0, 40);
    const syncConcurrency = 5;

    const syncChat = async (chat: any) => {
      const remoteJid = chat.id || chat.remoteJid;
      if (!remoteJid || remoteJid.endsWith('@g.us')) return 0; // Skip groups

      const phone = remoteJid.split('@')[0];

      const messages = await evolution.findMessages(instanceName, token, remoteJid, 50);

      if (!messages || messages.length === 0) return 0;

      let dbContact = await prisma.contact.findFirst({
        where: {
          organizationId: orgId,
          phone: { in: getBrazilianPhoneVariations(phone) }
        }
      });

      if (!dbContact) {
        dbContact = await prisma.contact.create({
          data: {
            phone,
            name: chat.name || chat.pushName || phone,
            organizationId: orgId,
          }
        });
      }

      const conversation = await prisma.conversation.findFirst({
        where: { contactId: dbContact.id, status: 'OPEN', whatsAppConnectionId: connection.id },
        orderBy: { updatedAt: 'desc' },
      });

      const activeConversation = conversation || await prisma.conversation.create({
        data: {
          contactId: dbContact.id,
          status: 'OPEN',
          stage: 'PRIMEIRO_CONTATO',
          temperature: 'COLD',
          lastMessageAt: new Date(),
          whatsAppConnectionId: connection.id,
        },
      });

      let latestMsgDate = activeConversation.lastMessageAt || new Date(0);
      const waMessageIds = Array.from(new Set(messages.map((msg: any) => msg.key?.id).filter(Boolean))) as string[];
      const existingMessages = waMessageIds.length > 0
        ? await prisma.message.findMany({
          where: { waMessageId: { in: waMessageIds } },
          select: { waMessageId: true },
        })
        : [];
      const existingMessageIds = new Set(existingMessages.map((message) => message.waMessageId).filter(Boolean));
      const queuedMessageIds = new Set<string>();
      const newMessageData = [];

      for (const msg of messages) {
        const waMessageId = msg.key?.id;
        if (!waMessageId) continue;
        if (existingMessageIds.has(waMessageId) || queuedMessageIds.has(waMessageId)) continue;

        const isOutbound = msg.key.fromMe;
        const msgTimestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

        const content =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.message?.documentMessage?.fileName ||
          'Mensagem importada (Mídia/Contato)';

        let type = 'TEXT';
        const messageType = msg.messageType || Object.keys(msg.message || {})[0] || '';

        if (messageType === 'audioMessage') type = 'AUDIO';
        else if (messageType === 'imageMessage') type = 'IMAGE';
        else if (messageType === 'videoMessage') type = 'VIDEO';
        else if (messageType === 'documentMessage') type = 'DOCUMENT';
        else if (messageType === 'stickerMessage') type = 'STICKER';
        else if (messageType === 'contactMessage' || messageType === 'contactsArrayMessage') type = 'CONTACT';

        queuedMessageIds.add(waMessageId);
        newMessageData.push({
          conversationId: activeConversation.id,
          waMessageId,
          direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
          type,
          content: content || 'Mensagem importada',
          timestamp: msgTimestamp,
          status: isOutbound ? 'READ' : 'RECEIVED',
          waMessageKey: msg.key || null,
          mediaStatus: isMediaMessageType(type) ? 'PENDING' : 'NONE',
        });

        if (msgTimestamp > latestMsgDate) latestMsgDate = msgTimestamp;
      }

      const result = newMessageData.length > 0
        ? await prisma.message.createMany({ data: newMessageData, skipDuplicates: true })
        : { count: 0 };

      if (!activeConversation.lastMessageAt || latestMsgDate > activeConversation.lastMessageAt) {
        await prisma.conversation.update({
          where: { id: activeConversation.id },
          data: { lastMessageAt: latestMsgDate }
        });
      }

      return result.count;
    };

    for (let index = 0; index < recentChats.length; index += syncConcurrency) {
      const results = await Promise.all(recentChats.slice(index, index + syncConcurrency).map(syncChat));
      newMessagesCount += results.reduce((sum, count) => sum + count, 0);
    }


    return { success: true, newMessages: newMessagesCount };
  } catch (e) {
    console.error('Failed to sync after reconnect:', e);
    return { success: false, error: String(e) };
  }
}

export async function syncSingleConversation(conversationId: string): Promise<{ success: boolean; newMessages: number; error?: string }> {
  try {
    const workspace = await ensurePaidWorkspace();
    const orgId = workspace.organizationId;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true }
    });

    if (!conversation || conversation.contact.organizationId !== orgId) {
      return { success: false, newMessages: 0, error: 'Conversation not found or unauthorized' };
    }

    if (!conversation.whatsAppConnectionId) {
      return { success: false, newMessages: 0, error: 'Conversation has no WhatsApp connection linked' };
    }

    const connection = await prisma.whatsAppConnection.findUnique({
      where: { id: conversation.whatsAppConnectionId },
    });

    if (!connection || connection.status !== 'CONNECTED' || !connection.instanceName || !connection.instanceToken) {
      return { success: false, newMessages: 0, error: 'WhatsApp connection is not connected' };
    }

    const { decryptToken } = await import('@/lib/encryption');
    const instanceName = connection.instanceName;
    const token = decryptToken(connection.instanceToken);

    const phone = conversation.contact.phone;
    const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    const messages = await evolution.findMessages(instanceName, token, remoteJid, 50);
    if (!messages || messages.length === 0) {
      return { success: true, newMessages: 0 };
    }

    let latestMsgDate = conversation.lastMessageAt || new Date(0);
    const waMessageIds = Array.from(new Set(messages.map((msg: any) => msg.key?.id).filter(Boolean))) as string[];
    const existingMessages = waMessageIds.length > 0
      ? await prisma.message.findMany({
        where: { waMessageId: { in: waMessageIds } },
        select: { waMessageId: true },
      })
      : [];
    const existingMessageIds = new Set(existingMessages.map((message) => message.waMessageId).filter(Boolean));
    const queuedMessageIds = new Set<string>();
    const newMessageData = [];

    for (const msg of messages) {
      const waMessageId = msg.key?.id;
      if (!waMessageId) continue;
      if (existingMessageIds.has(waMessageId) || queuedMessageIds.has(waMessageId)) continue;

      const isOutbound = msg.key.fromMe;
      const msgTimestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

      const content =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        msg.message?.documentMessage?.fileName ||
        'Mensagem importada (Mídia/Contato)';

      let type = 'TEXT';
      const messageType = msg.messageType || Object.keys(msg.message || {})[0] || '';

      if (messageType === 'audioMessage') type = 'AUDIO';
      else if (messageType === 'imageMessage') type = 'IMAGE';
      else if (messageType === 'videoMessage') type = 'VIDEO';
      else if (messageType === 'documentMessage') type = 'DOCUMENT';
      else if (messageType === 'stickerMessage') type = 'STICKER';
      else if (messageType === 'contactMessage' || messageType === 'contactsArrayMessage') type = 'CONTACT';

      queuedMessageIds.add(waMessageId);
      newMessageData.push({
        conversationId: conversation.id,
        waMessageId,
        direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
        type,
        content: content || 'Mensagem importada',
        timestamp: msgTimestamp,
        status: isOutbound ? 'READ' : 'RECEIVED',
        waMessageKey: msg.key || null,
        mediaStatus: isMediaMessageType(type) ? 'PENDING' : 'NONE',
      });

      if (msgTimestamp > latestMsgDate) latestMsgDate = msgTimestamp;
    }

    const result = newMessageData.length > 0
      ? await prisma.message.createMany({ data: newMessageData, skipDuplicates: true })
      : { count: 0 };

    if (!conversation.lastMessageAt || latestMsgDate > conversation.lastMessageAt) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: latestMsgDate, updatedAt: new Date() }
      });
    }

    return { success: true, newMessages: result.count };
  } catch (e) {
    console.error('Failed to sync single conversation:', e);
    return { success: false, newMessages: 0, error: String(e) };
  }
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const workspace = await ensurePaidWorkspace();

  try {
    // Ensure the conversation belongs to the organization
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        contact: { organizationId: workspace.organizationId }
      }
    });

    if (!conversation) return false;

    // Delete the conversation and cascade will handle the rest (messages, analysis, etc)
    await prisma.conversation.delete({
      where: { id: conversationId }
    });


    return true;
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return false;
  }
}

// ----------------------------------------------------------------------------
// MEETING SCHEDULING (Google Calendar)
// ----------------------------------------------------------------------------

export async function getOrganizationUsers() {
  const workspace = await ensurePaidWorkspace();
  const users = await prisma.user.findMany({
    where: { organizationId: workspace.organizationId },
    select: { id: true, name: true, email: true, role: true, googleAccessToken: true },
    orderBy: { name: 'asc' }
  });

  const session = await auth();
  if (session.userId) {
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: session.userId },
      select: { id: true, name: true, email: true, role: true, googleAccessToken: true }
    });

    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      users.unshift(currentUser);
    }
  }

  return users;
}

export async function getCurrentUserId() {
  const session = await auth();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { clerkId: session.userId },
    select: { id: true }
  });
  return user?.id || null;
}

export async function getCurrentUserInfo() {
  const session = await auth();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { clerkId: session.userId },
    select: { id: true, role: true }
  });
  return user || null;
}

export async function createMeeting(data: {
  contactId: string;
  closerId: string;
  title: string;
  type: string; // 'PRESENCIAL' | 'ONLINE'
  duration: number; // minutes
  scheduledAt: Date;
  location?: string;
  contactEmail?: string;
  notes?: string;
  timeZone?: string;
}) {
  const workspace = await ensurePaidWorkspace();
  const session = await auth();
  if (!session.userId) throw new Error("Unauthorized");

  const currentUserRecord = await prisma.user.findUnique({
    where: { clerkId: session.userId }
  });
  if (!currentUserRecord) throw new Error("User not found");

  // 1. Get contact and conversation to send notifications
  const contact = await prisma.contact.findFirst({
    where: { id: data.contactId, organizationId: workspace.organizationId },
    include: { conversations: { orderBy: { updatedAt: 'desc' }, take: 1 } }
  });
  if (!contact) throw new Error("Contact not found");

  // Save the contact email if it was provided and the contact doesn't have one
  if (data.contactEmail && !contact.email) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { email: data.contactEmail }
    });
  }

  const activeConversation = contact.conversations[0];

  // 2. Create Event via Google Calendar API if closer is provided and has token
  let googleEventId = undefined;
  let meetLink = undefined;

  if (data.closerId && data.contactEmail) {
    try {
      const { createCalendarEvent } = await import('@/lib/google-calendar');
      const eventDetails = await createCalendarEvent({
        userId: data.closerId,
        title: data.title,
        startAt: data.scheduledAt,
        endAt: new Date(data.scheduledAt.getTime() + data.duration * 60000),
        attendeeEmail: data.contactEmail,
        description: data.notes,
        location: data.location,
        isOnline: data.type === 'ONLINE',
        timeZone: data.timeZone,
      });
      googleEventId = eventDetails.eventId;
      meetLink = eventDetails.meetLink;
    } catch (e: any) {
      console.warn("Failed to create Google Calendar event, proceeding without it:", e.message);
    }
  } else if (!data.contactEmail) {
    console.warn("No contactEmail provided, skipping Google Calendar invite.");
  }

  // 3. Save Meeting to DB
  const meeting = await prisma.meeting.create({
    data: {
      contactId: data.contactId,
      organizationId: workspace.organizationId,
      closerId: data.closerId,
      createdById: currentUserRecord.id,
      title: data.title,
      type: data.type,
      duration: data.duration,
      scheduledAt: data.scheduledAt,
      location: data.location,
      meetLink: meetLink,
      googleEventId: googleEventId,
      contactEmail: data.contactEmail,
      notes: data.notes,
    }
  });

  // 4. Send Confirmation Message & Schedule Reminder
  if (activeConversation) {
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: data.timeZone || 'America/Sao_Paulo' }).format(data.scheduledAt);

    // Confirmation Message
    const confirmationText = `✅ Reunião confirmada para *${formattedDate}*.\n${data.type === 'ONLINE' ? `Link: ${meetLink || 'Enviado por email'}` : `Local: ${data.location}`}`;
    await sendConversationMessage(activeConversation.id, confirmationText).catch(console.error);

    // Schedule reminder for the day of the meeting (e.g. 2 hours before)
    const reminderTime = new Date(data.scheduledAt.getTime() - 2 * 60 * 60 * 1000);
    const reminderText = `⏳ Olá! Passando para lembrar da nossa reunião hoje às *${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone: data.timeZone || 'America/Sao_Paulo' }).format(data.scheduledAt)}*.\n${data.type === 'ONLINE' ? `Link do Meet: ${meetLink || 'No seu email'}` : `Endereço: ${data.location}`}\nAté logo!`;

    // Use the updated scheduleMessages with clearQueue = false
    await scheduleMessages(activeConversation.id, [{ content: reminderText, scheduledFor: reminderTime }], false).catch(console.error);

    // 5. Auto-move stage to "AGENDADO"
    // Find pipeline stage "Agendado" or create one if it doesn't exist
    let scheduledStage = await prisma.pipelineStage.findFirst({
      where: { organizationId: workspace.organizationId, name: { equals: "Agendado", mode: "insensitive" } }
    });

    if (!scheduledStage) {
      scheduledStage = await prisma.pipelineStage.create({
        data: {
          organizationId: workspace.organizationId,
          name: "Agendado",
          color: "bg-blue-500",
          order: 99
        }
      });
    }

    if (activeConversation.stage !== scheduledStage.name) {
      await updateConversationStage(activeConversation.id, scheduledStage.name);
    }
  }




  return meeting;
}

export async function getUpcomingMeetings(filterUserId?: string) {
  const workspace = await ensurePaidWorkspace();
  const now = new Date();

  // Próximos 7 dias
  const futureEnd = new Date();
  futureEnd.setDate(now.getDate() + 7);
  futureEnd.setHours(23, 59, 59, 999);

  const targetUserId = workspace.role === 'owner' ? filterUserId : workspace.id;

  return prisma.meeting.findMany({
    where: {
      organizationId: workspace.organizationId,
      scheduledAt: { gte: now, lte: futureEnd },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      ...(targetUserId ? { closerId: targetUserId } : {})
    },
    include: {
      contact: { select: { name: true, phone: true } },
      closer: { select: { name: true } }
    },
    orderBy: { scheduledAt: 'asc' }
  });
}

export async function reprocessMissingMedia(limit = 25) {
  const workspace = await ensurePaidWorkspace();
  if (workspace.role !== 'owner') {
    throw new Error('Apenas administradores podem reprocessar mídias.');
  }

  const mediaTypes = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'];
  const messages = await prisma.message.findMany({
    where: {
      type: { in: mediaTypes },
      media: null,
      waMessageId: { not: null },
      conversation: { contact: { organizationId: workspace.organizationId } },
    },
    include: {
      conversation: {
        include: {
          contact: true,
          whatsAppConnection: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  let recovered = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          mediaStatus: 'PROCESSING',
          mediaError: null,
          mediaAttempts: { increment: 1 },
          mediaLastAttemptAt: new Date(),
        },
      });

      const connection = message.conversation.whatsAppConnection || await prisma.whatsAppConnection.findFirst({
        where: {
          organizationId: workspace.organizationId,
          provider: 'EVOLUTION',
          status: 'CONNECTED',
        },
      });

      if (!connection?.instanceName || !connection.instanceToken) {
        throw new Error('Conexão Evolution ativa não encontrada.');
      }

      const { decryptToken } = await import('@/lib/encryption');
      const token = decryptToken(connection.instanceToken);
      const mediaPayload = await resolveEvolutionMediaPayload(
        connection.instanceName,
        token,
        message.waMessageKey,
        message.waMessageId,
        message.waMessagePayload,
      );
      const mediaResult = await evolution.getBase64FromMediaMessage(
        connection.instanceName,
        token,
        mediaPayload,
        60000,
      );

      if (!mediaResult?.base64) {
        throw new Error('Evolution não retornou a mídia. Ela pode ter expirado.');
      }

      await saveMessageMediaFromBase64({
        organizationId: workspace.organizationId,
        messageId: message.id,
        base64: mediaResult.base64,
        mimeType: mediaResult.mimetype,
        originalFileName: message.type === 'DOCUMENT' ? message.content : null,
      });

      recovered += 1;
    } catch (error) {
      failed += 1;
      await prisma.message.update({
        where: { id: message.id },
        data: {
          mediaStatus: 'FAILED',
          mediaError: error instanceof Error ? error.message : 'Falha desconhecida ao reprocessar mídia',
          mediaLastAttemptAt: new Date(),
        },
      }).catch(() => null);
    }
  }

  revalidatePath('/conversations');
  return { success: true, checked: messages.length, recovered, failed };
}

export async function getWorkspaceUsers() {
  const workspace = await ensurePaidWorkspace();
  if (workspace.role !== 'owner') {
    return [{ id: workspace.id, name: workspace.name, email: workspace.email }];
  }

  return prisma.user.findMany({
    where: { organizationId: workspace.organizationId },
    select: { id: true, name: true, email: true, role: true }
  });
}

// ==========================================
// TEAM MANAGEMENT
// ==========================================

export async function generateInviteLink() {
  const workspace = await ensurePaidWorkspace();

  // Clean up expired invites
  await prisma.invitation.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });

  const org = await prisma.organization.findUnique({
    where: { id: workspace.organizationId },
    select: { maxUsers: true, _count: { select: { users: true } } }
  });

  if (!org) throw new Error("Organização não encontrada.");
  if (org._count.users >= org.maxUsers) {
    throw new Error("Limite de usuários atingido. Faça upgrade do seu plano.");
  }

  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: workspace.organizationId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      role: "member"
    }
  });

  return invitation.token;
}

export async function acceptInvitation(token: string) {
  const session = await auth();
  if (!session.userId) throw new Error("Usuário não autenticado");

  const invitation = await prisma.invitation.findUnique({
    where: { token }
  });

  if (!invitation) throw new Error("Convite inválido ou já foi aceito.");
  if (invitation.expiresAt < new Date()) throw new Error("Este convite expirou.");

  const targetOrg = await prisma.organization.findUnique({
    where: { id: invitation.organizationId },
    select: { maxUsers: true, _count: { select: { users: true } } }
  });

  if (!targetOrg) throw new Error("Organização de destino não encontrada.");
  if (targetOrg._count.users >= targetOrg.maxUsers) {
    throw new Error("A organização de destino já atingiu o limite de usuários.");
  }

  // Garantir que o usuário existe no banco de dados
  await getCurrentWorkspace();

  const user = await prisma.user.findUnique({
    where: { clerkId: session.userId }
  });

  if (!user) throw new Error("Usuário não encontrado.");

  if (user.organizationId === invitation.organizationId) {
    // User is already in this organization
    await prisma.invitation.delete({ where: { id: invitation.id } });
    return { success: true };
  }

  // Save the old org id to check if it's an empty org that we should delete
  const oldOrgId = user.organizationId;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      organizationId: invitation.organizationId,
      role: invitation.role
    }
  });

  // Delete the invitation
  await prisma.invitation.delete({
    where: { id: invitation.id }
  });

  // If the old organization has no other users, it was likely an auto-generated one from signup. We can delete it.
  if (oldOrgId && oldOrgId !== invitation.organizationId) {
    const usersInOldOrg = await prisma.user.count({ where: { organizationId: oldOrgId } });
    if (usersInOldOrg === 0) {
      await prisma.organization.delete({ where: { id: oldOrgId } });
    }
  }

  revalidatePath('/settings');



  return { success: true };
}

export async function removeTeamMember(userId: string) {
  const workspace = await ensurePaidWorkspace();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId, organizationId: workspace.organizationId }
  });

  if (!targetUser) throw new Error("Usuário não encontrado na organização");
  if (targetUser.role === "owner") throw new Error("Não é possível remover o dono da conta");

  // Create a new empty organization for the removed user
  const newOrg = await prisma.organization.create({
    data: {
      name: `Workspace de ${targetUser.name || 'Usuário'}`,
      slug: `workspace-${targetUser.id.substring(0, 8)}`,
    }
  });

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      organizationId: newOrg.id,
      role: "owner"
    }
  });

  revalidatePath('/settings');
  return { success: true };
}

export async function disconnectGoogleCalendar() {
  const session = await auth();
  if (!session.userId) {
    throw new Error("Não autorizado");
  }

  await prisma.user.update({
    where: { clerkId: session.userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function updateContactEmail(contactId: string, email: string) {
  const { organizationId: workspaceId } = await getCurrentWorkspace();

  await prisma.contact.update({
    where: { id: contactId, organizationId: workspaceId },
    data: { email }
  });


  return { success: true };
}

export async function updateContactAddress(contactId: string, address: string) {
  const { organizationId: workspaceId } = await getCurrentWorkspace();

  await prisma.contact.update({
    where: { id: contactId, organizationId: workspaceId },
    data: { address }
  });


  return { success: true };
}

export async function resolveGoogleMapsAddress(url: string) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();

    // Tentativa 1: Buscar do título da página
    const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
    let address = null;

    if (titleMatch && titleMatch[1]) {
      const title = titleMatch[1].replace(' - Google Maps', '').trim();
      if (title && title !== 'Google Maps') {
        address = title;
      }
    }

    // Tentativa 2: Buscar da meta description
    if (!address) {
      const metaDescription = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
      if (metaDescription && metaDescription[1]) {
        // A description do Maps costuma ser "Find local businesses, view maps and get driving directions in Google Maps." se for geral.
        // Se for um local específico, costuma ter o endereço no texto.
        if (!metaDescription[1].includes('Find local businesses')) {
          address = metaDescription[1];
        }
      }
    }

    // Tentativa 3: Buscar tags do OpenGraph meta property="og:title"
    if (!address) {
      const ogTitle = text.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
      if (ogTitle && ogTitle[1]) {
        address = ogTitle[1];
      }
    }

    return { success: true, address: address || 'Endereço não encontrado' };
  } catch (err) {
    console.error('Error resolving Maps URL:', err);
    return { success: false, address: null };
  }
}

// ==========================================
// QUICK REPLIES MANAGEMENT
// ==========================================

export interface QuickReplyData {
  id: string;
  shortcut: string;
  title: string;
  content: string;
}

export async function getQuickReplies(): Promise<QuickReplyData[]> {
  const workspace = await ensurePaidWorkspace();

  const replies = await prisma.quickReply.findMany({
    where: {
      organizationId: workspace.organizationId,
      userId: workspace.id
    },
    orderBy: { shortcut: 'asc' }
  });

  return replies.map(r => ({
    id: r.id,
    shortcut: r.shortcut,
    title: r.title,
    content: r.content
  }));
}

export async function createQuickReply(shortcut: string, title: string, content: string) {
  const workspace = await ensurePaidWorkspace();

  // Format shortcut to lowercase without spaces
  const cleanShortcut = shortcut.toLowerCase().replace(/\s+/g, '');

  try {
    const reply = await prisma.quickReply.create({
      data: {
        organizationId: workspace.organizationId,
        userId: workspace.id,
        shortcut: cleanShortcut,
        title,
        content
      }
    });
    return { success: true, reply };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Já existe uma resposta com esse atalho.' };
    }
    return { success: false, error: 'Erro ao criar resposta rápida.' };
  }
}

export async function updateQuickReply(id: string, shortcut: string, title: string, content: string) {
  const workspace = await ensurePaidWorkspace();
  const cleanShortcut = shortcut.toLowerCase().replace(/\s+/g, '');

  try {
    const reply = await prisma.quickReply.update({
      where: {
        id,
        organizationId: workspace.organizationId,
        userId: workspace.id
      },
      data: {
        shortcut: cleanShortcut,
        title,
        content
      }
    });
    return { success: true, reply };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Já existe uma resposta com esse atalho.' };
    }
    return { success: false, error: 'Erro ao atualizar resposta rápida.' };
  }
}

export async function deleteQuickReply(id: string) {
  const workspace = await ensurePaidWorkspace();

  try {
    await prisma.quickReply.delete({
      where: {
        id,
        organizationId: workspace.organizationId,
        userId: workspace.id
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao excluir resposta rápida.' };
  }
}

export async function updateOrganizationNotificationSettings(dealEmail: string | null, masterclassEmail: string | null) {
  const workspace = await ensurePaidWorkspace();
  if (workspace.role !== 'owner') {
    throw new Error('Apenas administradores podem atualizar estas configurações.');
  }

  await prisma.organization.update({
    where: { id: workspace.organizationId },
    data: {
      dealNotificationEmail: dealEmail,
      masterclassNotificationEmail: masterclassEmail
    }
  });

  return { success: true };
}

export async function getClosedDealFormData(leadId: string): Promise<ClosedDealFormData> {
  const workspace = await ensurePaidWorkspace();

  const contact = await prisma.contact.findFirst({
    where: { id: leadId, organizationId: workspace.organizationId },
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      email: true,
      origin: true,
      notes: true,
      monthlyRevenue: true,
      mainChallenges: true,
      assignedUser: { select: { name: true, email: true } },
      potentialValue: true,
      productId: true,
      product: { select: { name: true, price: true } },
      contactProducts: {
        select: {
          productId: true,
          customName: true,
          customPrice: true,
          product: { select: { name: true, price: true } },
        },
      },
      closedDeals: {
        orderBy: { closedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          totalValue: true,
          installmentCount: true,
          firstPaymentValue: true,
          firstPaymentDate: true,
          projectDuration: true,
          paymentMethod: true,
          hasSignal: true,
          signalValue: true,
          notes: true,
          productsJson: true,
          closedAt: true,
        },
      },
    },
  });

  if (!contact) {
    throw new Error('Lead nao encontrado.');
  }

  const snapshot = buildClosedDealSnapshot(contact);
  const existingDeal = contact.closedDeals[0] || null;
  const savedProducts = Array.isArray(existingDeal?.productsJson)
    ? (existingDeal.productsJson as unknown as ClosedDealProductSnapshot[])
    : null;

  return {
    lead: {
      id: contact.id,
      name: contact.name,
      company: contact.company,
      phone: contact.phone,
      email: contact.email,
    },
    totalValue: existingDeal?.totalValue ?? snapshot.totalValue,
    products: savedProducts && savedProducts.length > 0 ? savedProducts : snapshot.products,
    existingDeal: existingDeal ? {
      id: existingDeal.id,
      totalValue: existingDeal.totalValue,
      installmentCount: existingDeal.installmentCount,
      firstPaymentValue: existingDeal.firstPaymentValue,
      firstPaymentDate: existingDeal.firstPaymentDate || null,
      projectDuration: existingDeal.projectDuration,
      paymentMethod: existingDeal.paymentMethod,
      hasSignal: existingDeal.hasSignal,
      signalValue: existingDeal.signalValue,
      notes: existingDeal.notes,
      closedAt: existingDeal.closedAt.toISOString(),
    } : null,
  };
}

async function ensureReportToken(orgId: string): Promise<string> {
  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { reportToken: true },
  });
  if (existing?.reportToken) return existing.reportToken;

  const token = crypto.randomUUID();
  await prisma.organization.update({
    where: { id: orgId },
    data: { reportToken: token },
  });
  return token;
}

export async function dispatchClosedDeal(leadId: string, data: ClosedDealDispatchInput) {
  const workspace = await ensurePaidWorkspace();

  if (!Number.isFinite(data.installmentCount) || data.installmentCount < 1) {
    throw new Error('Informe a quantidade de parcelas.');
  }

  if (!data.firstPaymentDate || data.firstPaymentDate < 1 || data.firstPaymentDate > 31) {
    throw new Error('Informe o melhor dia para vencimento (1 a 31).');
  }

  const firstPaymentDate = Math.floor(data.firstPaymentDate);

  const projectDuration = data.projectDuration.trim();
  if (!projectDuration) {
    throw new Error('Informe o tempo de projeto.');
  }

  const contact = await prisma.contact.findFirst({
    where: { id: leadId, organizationId: workspace.organizationId },
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      email: true,
      origin: true,
      notes: true,
      monthlyRevenue: true,
      mainChallenges: true,
      assignedUser: { select: { name: true, email: true } },
      potentialValue: true,
      productId: true,
      product: { select: { name: true, price: true } },
      contactProducts: {
        select: {
          productId: true,
          customName: true,
          customPrice: true,
          product: { select: { name: true, price: true } },
        },
      },
      conversations: {
        orderBy: { updatedAt: 'desc' },
        select: { id: true, stage: true },
      },
    },
  });

  if (!contact) {
    throw new Error('Lead nao encontrado.');
  }

  const snapshot = buildClosedDealSnapshot(contact);
  const totalValue = snapshot.totalValue;
  const latestConversation = contact.conversations[0] || null;
  const targetStage = data.targetStage?.trim() || latestConversation?.stage || 'Negócio Fechado';
  const normalizedSignalValue = data.hasSignal ? (data.signalValue ?? 0) : null;

  const org = await prisma.organization.findUnique({
    where: { id: workspace.organizationId },
    select: { dealNotificationEmail: true },
  });

  const targetEmail = org?.dealNotificationEmail?.trim();
  if (!targetEmail) {
    throw new Error('Configure o e-mail de despacho em Configurações > Sistema antes de despachar a venda.');
  }

  const reportToken = await ensureReportToken(workspace.organizationId);
  const now = new Date();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL || 'sales.arcaffo.com'}`).replace(/\/$/, '');
  const reportUrl = `${baseUrl}/api/export/monthly-report?token=${reportToken}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(now);

  const deal = await prisma.$transaction(async (tx) => {
    const savedDeal = await tx.closedDeal.upsert({
      where: {
        organizationId_contactId: {
          organizationId: workspace.organizationId,
          contactId: contact.id,
        },
      },
      update: {
        conversationId: latestConversation?.id || null,
        totalValue,
        installmentCount: Math.floor(data.installmentCount),
        firstPaymentValue: data.hasSignal ? (data.signalValue ?? 0) : 0,
        firstPaymentDate,
        projectDuration,
        paymentMethod: data.paymentMethod,
        hasSignal: data.hasSignal,
        signalValue: normalizedSignalValue,
        notes: data.notes?.trim() || null,
        productsJson: snapshot.products,
        closedByUserId: workspace.id,
      },
      create: {
        organizationId: workspace.organizationId,
        contactId: contact.id,
        conversationId: latestConversation?.id || null,
        totalValue,
        installmentCount: Math.floor(data.installmentCount),
        firstPaymentValue: data.hasSignal ? (data.signalValue ?? 0) : 0,
        firstPaymentDate,
        projectDuration,
        paymentMethod: data.paymentMethod,
        hasSignal: data.hasSignal,
        signalValue: normalizedSignalValue,
        notes: data.notes?.trim() || null,
        productsJson: snapshot.products,
        closedByUserId: workspace.id,
      },
    });

    for (const conversation of contact.conversations) {
      if (conversation.stage !== targetStage) {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { stage: targetStage },
        });

        await tx.leadStageHistory.create({
          data: {
            contactId: contact.id,
            fromStage: conversation.stage,
            toStage: targetStage,
            reason: 'Venda despachada',
            changedBy: workspace.id,
          },
        });
      }
    }

    await tx.contact.update({
      where: { id: contact.id },
      data: { isLead: true },
    });

    return savedDeal;
  });

  const sellerName = workspace.name || 'Vendedor';
  const productList = snapshot.products.map((product) => product.name).join(', ') || 'Nenhum listado';
  const signalText = data.hasSignal ? `Sim (${formatCurrency(normalizedSignalValue)})` : 'Nao';
  const dispatchedAt = new Date();
  const dispatchedAtLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(dispatchedAt);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #333;">
      <div style="background-color: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">VENDA DESPACHADA</h1>
      </div>

      <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">O vendedor <strong>${sellerName}</strong> despachou uma venda em <strong>${dispatchedAtLabel}</strong>. Seguem os dados para financeiro e entrega:</p>

        <h3 style="margin-top: 24px; color: #10b981;">Cliente</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; width: 38%;"><strong>Nome:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.name}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Empresa:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.company || 'Nao informado'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Telefone:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.phone}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>E-mail:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.email || 'Nao informado'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Origem:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.origin || 'Nao informado'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Faturamento Mensal:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.monthlyRevenue ? formatCurrency(contact.monthlyRevenue) : 'Nao informado'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vendedor Responsavel:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.assignedUser?.name || sellerName}</td></tr>
        </table>

        <h3 style="margin-top: 24px; color: #10b981;">Venda</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; width: 38%;"><strong>Valor Total:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formatCurrency(totalValue)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Produtos Vendidos:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${productList}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quantidade de Parcelas:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${Math.floor(data.installmentCount)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vencimento:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${firstPaymentDate}º dia do mês</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tempo de Projeto:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${projectDuration}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Forma de Pagamento:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.paymentMethod}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Pagou Sinal:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${signalText}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Etapa no CRM:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${targetStage}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Data/Hora do Despacho:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dispatchedAtLabel}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Observacoes da Venda:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.notes?.trim() || 'Nenhuma observacao'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Anotacoes do Lead:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.notes || 'Nenhuma anotacao'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Desafios:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.mainChallenges || 'Nao informado'}</td></tr>
        </table>

        <div style="margin-top: 24px; background: #09090b; border: 1px solid #10b981; border-radius: 8px; padding: 20px; text-align: center;">
          <p style="color: #10b981; font-size: 14px; font-weight: bold; margin: 0 0 4px;">Relatorio Mensal de Vendas</p>
          <p style="color: #a1a1aa; font-size: 11px; margin: 0 0 14px;">Baixe a planilha completa com todas as vendas de ${monthName}/${now.getFullYear()}</p>
          <a href="${reportUrl}" style="display: inline-block; background: #10b981; color: #000; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 12px; font-weight: bold;">BAIXAR RELATORIO XLSX</a>
        </div>
      </div>
    </div>
  `;

  const { sendEmailViaGmail } = await import('@/lib/gmail');
  await sendEmailViaGmail(workspace.id, targetEmail, `VENDA DESPACHADA - ${contact.name}`, html);

  revalidatePath('/leads');
  revalidatePath('/conversations');
  revalidatePath('/dashboard');
  revalidatePath('/reports');

  return { success: true, emailSent: true, dealId: deal.id };
}

export async function closeDealAction(leadId: string, data: { paymentMethod: string; notes: string; hasSignal: boolean; signalValue?: number }) {
  const workspace = await ensurePaidWorkspace();
  const { sendEmailViaGmail } = await import('@/lib/gmail');

  // Recuperar lead e info do vendedor
  const contact = await prisma.contact.findUnique({
    where: { id: leadId, organizationId: workspace.organizationId },
    include: {
      contactProducts: { include: { product: true } }
    }
  });

  if (!contact) throw new Error('Lead não encontrado.');

  const org = await prisma.organization.findUnique({
    where: { id: workspace.organizationId },
    select: { dealNotificationEmail: true }
  });

  const targetEmail = org?.dealNotificationEmail || 'time@arcaffo.com.br';
  const sellerName = workspace.name || 'Vendedor';
  const reportToken = await ensureReportToken(workspace.organizationId);
  const now = new Date();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL || 'sales.arcaffo.com'}`).replace(/\/$/, '');
  const reportUrl = `${baseUrl}/api/export/monthly-report?token=${reportToken}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(now);

  // Atualizar as conversas se tiver
  await prisma.conversation.updateMany({
    where: { contactId: contact.id },
    data: { stage: 'Fechamento' }
  });

  // Frases motivacionais
  const phrases = [
    "Mais um cliente na casa! Vamos entregar o nosso melhor e superar as expectativas! 🚀",
    "O show começou! Que o nosso comprometimento e excelência brilhem na entrega. Vamos pra cima! 🔥",
    "Trabalho em equipe faz o sonho funcionar. Esse cliente confiou, agora é hora de entregar mágica! 🌟",
    "Cada novo contrato é uma nova oportunidade de fazer história. Bora com tudo, time de elite! 💪",
    "Mais uma vitória para o nosso time! Que a execução deste serviço seja impecável. Avante! 🏁"
  ];
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];

  // Formatar Produtos
  const productList = contact.contactProducts.map(cp => cp.product?.name || cp.customName || 'Produto Genérico').join(', ') || 'Nenhum listado';
  const signalText = data.hasSignal ? `Sim (R$ ${data.signalValue || 0})` : 'Não';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">🎉 NEGÓCIO FECHADO!</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Olá time,</p>
        <p style="font-size: 16px;">O vendedor <strong>${sellerName}</strong> acaba de fechar mais um negócio! Seguem as informações do cliente:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; width: 35%;"><strong>Nome do Lead:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.name}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Empresa:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.company || 'Não informado'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Telefone:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.phone}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>E-mail:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact.email || 'Não informado'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Produtos/Serviços:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${productList}</td></tr>
        </table>
        
        <h3 style="margin-top: 30px; color: #10b981;">Detalhes da Transação</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; width: 35%;"><strong>Forma de Pagamento:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.paymentMethod}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Pagou Sinal:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${signalText}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Observações:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.notes || 'Nenhuma observação'}</td></tr>
        </table>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 4px;">
          <p style="margin: 0; font-style: italic; color: #475569;">"${phrase}"</p>
        </div>

        <div style="margin-top: 24px; background: #09090b; border: 1px solid #10b981; border-radius: 8px; padding: 20px; text-align: center;">
          <p style="color: #10b981; font-size: 14px; font-weight: bold; margin: 0 0 4px;">Relatorio Mensal de Vendas</p>
          <p style="color: #a1a1aa; font-size: 11px; margin: 0 0 14px;">Baixe a planilha completa com todas as vendas de ${monthName}/${now.getFullYear()}</p>
          <a href="${reportUrl}" style="display: inline-block; background: #10b981; color: #000; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 12px; font-weight: bold;">BAIXAR RELATORIO XLSX</a>
        </div>
      </div>
    </div>
  `;

  await sendEmailViaGmail(workspace.id, targetEmail, `NEGÓCIO FECHADO 🔔🔔🔔 por ${sellerName}`, html);

  return { success: true };
}

export async function inviteToMasterclassAction(leadId: string, data: { reason: string }) {
  const workspace = await ensurePaidWorkspace();
  const { sendEmailViaGmail } = await import('@/lib/gmail');

  const contact = await prisma.contact.findUnique({
    where: { id: leadId, organizationId: workspace.organizationId }
  });

  if (!contact) throw new Error('Lead não encontrado.');

  const org = await prisma.organization.findUnique({
    where: { id: workspace.organizationId },
    select: { masterclassNotificationEmail: true }
  });

  const targetEmail = org?.masterclassNotificationEmail || 'relacionamento@arcaffo.com.br';
  const sellerName = workspace.name || 'Vendedor';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <p>Bom dia!</p>
      <p>Convidei <strong>${contact.name}</strong> para nossa masterclass deste mês. Por favor, fazer onboarding!</p>
      <p><strong>Motivo do convite:</strong> ${data.reason}</p>
      <p><em>ps: caso não tenha mais vaga para este mês, ajustar para confirmar presença para o próximo.</em></p>
      <br>
      <p>Tamo junto, time!</p>
      <p>Atenciosamente,<br><strong>${sellerName}</strong></p>
    </div>
  `;
  const text = `Bom dia!

Convidei ${contact.name} para nossa masterclass deste mês. Por favor, fazer onboarding!

Motivo do convite: ${data.reason}

ps: caso não tenha mais vaga para este mês, ajustar para confirmar presença para o próximo.

Tamo junto, time!
Atenciosamente,
${sellerName}`;

  await sendEmailViaGmail(workspace.id, targetEmail, `ENVIAR ONBOARDING DA MASTERCLASS - ${contact.name}`, html, text);

  return { success: true };
}

export type ContactData = {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  email: string | null;
  interestArea: string | null;
  origin: string | null;
  notes: string | null;
  potentialValue: number | null;
  isLead: boolean;
  address: string | null;
  monthlyRevenue: number | null;
  mainChallenges: string | null;
  productId: string | null;
  productName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  conversationId: string | null;
  hasConversation: boolean;
};

export async function getContacts(options?: {
  search?: string;
  origin?: string;
  isLead?: boolean;
  productId?: string;
  assignedUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ contacts: ContactData[]; total: number }> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  const where: any = { organizationId: orgId };

  if (options?.isLead !== undefined) {
    where.isLead = options.isLead;
  }

  if (options?.origin) {
    where.origin = options.origin;
  }

  if (options?.productId) {
    where.OR = [
      { productId: options.productId },
      { contactProducts: { some: { productId: options.productId } } },
    ];
  }

  if (options?.assignedUserId) {
    where.assignedUserId = options.assignedUserId;
  }

  if (options?.search) {
    const search = options.search.trim();
    const searchWhere = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
    where.AND = where.AND ? [...where.AND, searchWhere] : [searchWhere];
  }

  const [total, rows] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        company: true,
        email: true,
        interestArea: true,
        origin: true,
        notes: true,
        potentialValue: true,
        isLead: true,
        address: true,
        monthlyRevenue: true,
        mainChallenges: true,
        productId: true,
        product: { select: { name: true } },
        assignedUserId: true,
        assignedUser: { select: { name: true } },
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        conversations: {
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      ...(options?.limit ? { take: options.limit } : { take: 50 }),
      ...(options?.offset ? { skip: options.offset } : { skip: 0 }),
    }),
  ]);

  const contacts: ContactData[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    company: row.company,
    email: row.email,
    interestArea: row.interestArea,
    origin: row.origin,
    notes: row.notes,
    potentialValue: row.potentialValue,
    isLead: row.isLead,
    address: row.address,
    monthlyRevenue: row.monthlyRevenue,
    mainChallenges: row.mainChallenges,
    productId: row.productId,
    productName: row.product?.name || null,
    assignedUserId: row.assignedUserId,
    assignedUserName: row.assignedUser?.name || null,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    conversationId: row.conversations[0]?.id || null,
    hasConversation: row.conversations.length > 0,
  }));

  return { contacts, total };
}

export async function createContact(data: {
  name: string;
  phone: string;
  company?: string | null;
  email?: string | null;
  interestArea?: string | null;
  origin?: string | null;
  notes?: string | null;
  potentialValue?: number | null;
  address?: string | null;
  monthlyRevenue?: number | null;
  mainChallenges?: string | null;
  productId?: string | null;
  assignedUserId?: string | null;
}) {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;

  const phoneClean = data.phone.replace(/\D/g, '');
  if (!phoneClean) {
    throw new Error('Telefone é obrigatório.');
  }

  if (!data.name.trim()) {
    throw new Error('Nome é obrigatório.');
  }

  const resolved = await resolveOrCreateContact({
    organizationId: orgId,
    name: data.name,
    phone: phoneClean,
    company: data.company,
    email: data.email,
    interestArea: data.interestArea,
    origin: data.origin,
    notes: data.notes,
    potentialValue: data.potentialValue,
    address: data.address,
    monthlyRevenue: data.monthlyRevenue,
    mainChallenges: data.mainChallenges,
    assignedUserId: data.assignedUserId,
    source: 'Cadastro manual',
  });

  let contact = resolved.contact;
  if (data.productId && !contact.productId) {
    contact = await prisma.contact.update({ where: { id: contact.id }, data: { productId: data.productId } });
  }

  revalidatePath('/contacts');
  revalidatePath('/conversations');
  return contact;
}

export async function updateContact(
  id: string,
  data: {
    name?: string;
    phone?: string;
    company?: string | null;
    email?: string | null;
    interestArea?: string | null;
    origin?: string | null;
    notes?: string | null;
    potentialValue?: number | null;
    address?: string | null;
    monthlyRevenue?: number | null;
    mainChallenges?: string | null;
    productId?: string | null;
    assignedUserId?: string | null;
  }
) {
  const workspace = await ensurePaidWorkspace();

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.phone !== undefined) updateData.phone = data.phone.replace(/\D/g, '');
  if (data.company !== undefined) updateData.company = data.company?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;
  if (data.interestArea !== undefined) updateData.interestArea = data.interestArea?.trim() || null;
  if (data.origin !== undefined) updateData.origin = data.origin?.trim() || null;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
  if (data.potentialValue !== undefined) updateData.potentialValue = data.potentialValue;
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;
  if (data.monthlyRevenue !== undefined) updateData.monthlyRevenue = data.monthlyRevenue;
  if (data.mainChallenges !== undefined) updateData.mainChallenges = data.mainChallenges?.trim() || null;
  if (data.productId !== undefined) updateData.productId = data.productId;
  if (data.assignedUserId !== undefined) updateData.assignedUserId = data.assignedUserId;

  const contact = await prisma.contact.update({
    where: { id, organizationId: workspace.organizationId },
    data: updateData,
  });

  await ensureContactIdentities({
    organizationId: workspace.organizationId,
    contactId: contact.id,
    phone: contact.phone,
    email: contact.email,
  });

  revalidatePath('/contacts');
  revalidatePath('/conversations');
  return contact;
}

export async function deleteContact(id: string) {
  const workspace = await ensurePaidWorkspace();

  await prisma.contact.delete({
    where: { id, organizationId: workspace.organizationId },
  });

  revalidatePath('/contacts');
  return { success: true };
}

export type DuplicateContactCandidate = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  isLead: boolean;
  updatedAt: string;
  score: number;
  counts: {
    conversations: number;
    products: number;
    tasks: number;
    meetings: number;
    closedDeals: number;
    identities: number;
  };
};

export type DuplicateContactGroup = {
  id: string;
  reasons: string[];
  recommendedPrimaryId: string;
  contacts: DuplicateContactCandidate[];
};

export type DuplicateContactsReport = {
  groups: DuplicateContactGroup[];
  totalGroups: number;
  totalContacts: number;
  backfillNeeded: number;
};

function assertOwnerWorkspace(workspace: Awaited<ReturnType<typeof ensurePaidWorkspace>>) {
  if (workspace.role !== 'owner') {
    throw new Error('Apenas administradores podem executar esta ação.');
  }
}

function normalizeContactEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function appendMergedText(existing: string | null, incoming: string | null, label: string) {
  const value = incoming?.trim();
  if (!value) return existing;
  if (existing?.toLowerCase().includes(value.toLowerCase())) return existing;
  return existing ? `${existing}\n\n[Merge ${label}] ${value}` : value;
}

function getDuplicateIdentityKeys(contact: { phone: string; email: string | null }) {
  const keys = getPhoneIdentityValues(contact.phone).map((value) => `PHONE:${value}`);
  const email = normalizeContactEmail(contact.email);
  if (email) keys.push(`EMAIL:${email}`);
  return Array.from(new Set(keys));
}

function duplicateReasonLabel(key: string) {
  const [type, value] = key.split(':');
  return type === 'EMAIL' ? `Email ${value}` : `Telefone ${value}`;
}

export async function getDuplicateContactsReport(): Promise<DuplicateContactsReport> {
  const workspace = await ensurePaidWorkspace();
  assertOwnerWorkspace(workspace);
  const orgId = workspace.organizationId;

  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      company: true,
      isLead: true,
      notes: true,
      mainChallenges: true,
      potentialValue: true,
      monthlyRevenue: true,
      productId: true,
      assignedUserId: true,
      updatedAt: true,
      identities: { select: { type: true, value: true } },
      _count: {
        select: {
          conversations: true,
          contactProducts: true,
          tasks: true,
          meetings: true,
          closedDeals: true,
          identities: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const identityMap = new Map<string, string[]>();
  let backfillNeeded = 0;

  for (const contact of contacts) {
    const expectedKeys = getDuplicateIdentityKeys(contact);
    const actualKeys = new Set(contact.identities.map((identity) => `${identity.type}:${identity.value}`));
    if (expectedKeys.some((key) => !actualKeys.has(key))) backfillNeeded++;
    for (const key of expectedKeys) {
      const list = identityMap.get(key) || [];
      list.push(contact.id);
      identityMap.set(key, list);
    }
  }

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) || id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const ids of identityMap.values()) {
    if (ids.length < 2) continue;
    const [first, ...rest] = ids;
    for (const id of rest) union(first, id);
  }

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const groupedIds = new Map<string, Set<string>>();
  for (const contact of contacts) {
    const root = find(contact.id);
    if (root === contact.id && !Array.from(identityMap.values()).some((ids) => ids.length > 1 && ids.includes(contact.id))) continue;
    const set = groupedIds.get(root) || new Set<string>();
    set.add(contact.id);
    groupedIds.set(root, set);
  }

  const duplicateKeysByGroup = new Map<string, Set<string>>();
  for (const [key, ids] of identityMap.entries()) {
    if (ids.length < 2) continue;
    const root = find(ids[0]);
    const set = duplicateKeysByGroup.get(root) || new Set<string>();
    set.add(key);
    duplicateKeysByGroup.set(root, set);
    const groupSet = groupedIds.get(root) || new Set<string>();
    ids.forEach((id) => groupSet.add(id));
    groupedIds.set(root, groupSet);
  }

  const groups: DuplicateContactGroup[] = Array.from(groupedIds.entries())
    .map(([root, ids]) => {
      const candidates = Array.from(ids)
        .map((id) => contactById.get(id))
        .filter(Boolean)
        .map((contact) => {
          const score =
            contact!._count.conversations * 10 +
            contact!._count.closedDeals * 20 +
            contact!._count.tasks * 3 +
            contact!._count.meetings * 3 +
            contact!._count.contactProducts * 2 +
            contact!._count.identities +
            (contact!.isLead ? 5 : 0) +
            (contact!.email ? 2 : 0) +
            (contact!.company ? 2 : 0) +
            (contact!.notes ? 1 : 0) +
            (contact!.mainChallenges ? 1 : 0) +
            (contact!.potentialValue ? 1 : 0) +
            (contact!.monthlyRevenue ? 1 : 0) +
            (contact!.productId ? 1 : 0) +
            (contact!.assignedUserId ? 1 : 0);

          return {
            id: contact!.id,
            name: contact!.name,
            phone: contact!.phone,
            email: contact!.email,
            company: contact!.company,
            isLead: contact!.isLead,
            updatedAt: contact!.updatedAt.toISOString(),
            score,
            counts: {
              conversations: contact!._count.conversations,
              products: contact!._count.contactProducts,
              tasks: contact!._count.tasks,
              meetings: contact!._count.meetings,
              closedDeals: contact!._count.closedDeals,
              identities: contact!._count.identities,
            },
          };
        })
        .sort((a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return {
        id: root,
        reasons: Array.from(duplicateKeysByGroup.get(root) || []).map(duplicateReasonLabel),
        recommendedPrimaryId: candidates[0]?.id || root,
        contacts: candidates,
      };
    })
    .filter((group) => group.contacts.length > 1)
    .sort((a, b) => b.contacts.length - a.contacts.length || b.contacts[0].score - a.contacts[0].score);

  return {
    groups,
    totalGroups: groups.length,
    totalContacts: groups.reduce((sum, group) => sum + group.contacts.length, 0),
    backfillNeeded,
  };
}

export type ContactIdentityBackfillBatchResult = {
  success: true;
  total: number;
  processed: number;
  attempted: number;
  created: number;
  skipped: number;
  nextCursor: string | null;
  done: boolean;
};

export async function backfillContactIdentitiesBatch(input?: { cursor?: string | null; batchSize?: number }): Promise<ContactIdentityBackfillBatchResult> {
  const workspace = await ensurePaidWorkspace();
  assertOwnerWorkspace(workspace);
  const orgId = workspace.organizationId;
  const batchSize = Math.min(Math.max(input?.batchSize || 250, 50), 500);

  const [total, rows] = await Promise.all([
    prisma.contact.count({ where: { organizationId: orgId } }),
    prisma.contact.findMany({
      where: { organizationId: orgId },
      select: { id: true, phone: true, email: true },
      orderBy: { id: 'asc' },
      take: batchSize + 1,
      ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = rows.length > batchSize;
  const contacts = hasMore ? rows.slice(0, batchSize) : rows;
  const nextCursor = hasMore ? contacts[contacts.length - 1]?.id || null : null;

  const identityMap = new Map<string, { organizationId: string; contactId: string; type: string; value: string }>();
  for (const contact of contacts) {
    for (const value of getPhoneIdentityValues(contact.phone)) {
      identityMap.set(`${orgId}:PHONE:${value}`, { organizationId: orgId, contactId: contact.id, type: 'PHONE', value });
    }
    const email = normalizeContactEmail(contact.email);
    if (email) {
      identityMap.set(`${orgId}:EMAIL:${email}`, { organizationId: orgId, contactId: contact.id, type: 'EMAIL', value: email });
    }
  }

  const identities = Array.from(identityMap.values());
  const result = identities.length > 0
    ? await prisma.contactIdentity.createMany({ data: identities, skipDuplicates: true })
    : { count: 0 };

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId: workspace.id,
      action: 'CONTACT_IDENTITIES_BACKFILL_BATCH',
      entity: 'ContactIdentity',
      metadata: {
        batchSize,
        processed: contacts.length,
        attempted: identities.length,
        created: result.count,
        skipped: identities.length - result.count,
        cursor: input?.cursor || null,
        nextCursor,
        done: !hasMore,
      },
    },
  }).catch(() => null);

  if (!hasMore) {
    revalidatePath('/contacts');
    revalidatePath('/conversations');
  }

  return {
    success: true,
    total,
    processed: contacts.length,
    attempted: identities.length,
    created: result.count,
    skipped: identities.length - result.count,
    nextCursor,
    done: !hasMore,
  };
}

export async function backfillContactIdentities() {
  return backfillContactIdentitiesBatch({ batchSize: 250 });
}

export async function mergeDuplicateContacts(primaryContactId: string, duplicateContactIds: string[]) {
  const workspace = await ensurePaidWorkspace();
  assertOwnerWorkspace(workspace);
  const orgId = workspace.organizationId;

  const uniqueDuplicateIds = Array.from(new Set(duplicateContactIds.filter((id) => id && id !== primaryContactId)));
  if (!primaryContactId || uniqueDuplicateIds.length === 0) {
    throw new Error('Selecione um contato principal e pelo menos um duplicado.');
  }

  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId, id: { in: [primaryContactId, ...uniqueDuplicateIds] } },
    include: {
      closedDeals: { select: { id: true } },
      conversations: { select: { id: true, status: true, lastMessageAt: true } },
      contactProducts: true,
      identities: true,
    },
  });

  const primary = contacts.find((contact) => contact.id === primaryContactId);
  const duplicates = contacts.filter((contact) => uniqueDuplicateIds.includes(contact.id));
  if (!primary || duplicates.length !== uniqueDuplicateIds.length) {
    throw new Error('Contato não encontrado nesta organização.');
  }

  const closedDealCount = contacts.reduce((sum, contact) => sum + contact.closedDeals.length, 0);
  if (closedDealCount > 1) {
    throw new Error('Merge bloqueado: mais de um contato selecionado possui venda fechada. Resolva manualmente para não perder histórico financeiro.');
  }

  const now = new Date();
  const primaryOpenConversation = await resolveOpenConversation({ contactId: primary.id, lastMessageAt: now });

  await prisma.$transaction(async (tx) => {
    let updateData: Record<string, unknown> = {};
    let nextNotes = primary.notes;
    let nextChallenges = primary.mainChallenges;

    const setIfEmpty = (field: string, value: unknown) => {
      if (value === null || value === undefined || value === '') return;
      if ((primary as any)[field] === null || (primary as any)[field] === undefined || (primary as any)[field] === '') {
        updateData[field] = value;
      }
    };

    for (const duplicate of duplicates) {
      setIfEmpty('email', duplicate.email);
      setIfEmpty('company', duplicate.company);
      setIfEmpty('interestArea', duplicate.interestArea);
      setIfEmpty('origin', duplicate.origin);
      setIfEmpty('address', duplicate.address);
      setIfEmpty('potentialValue', duplicate.potentialValue);
      setIfEmpty('monthlyRevenue', duplicate.monthlyRevenue);
      setIfEmpty('productId', duplicate.productId);
      setIfEmpty('assignedUserId', duplicate.assignedUserId);
      if (duplicate.isLead && !primary.isLead) updateData.isLead = true;
      nextNotes = appendMergedText(nextNotes, duplicate.notes, duplicate.name);
      nextChallenges = appendMergedText(nextChallenges, duplicate.mainChallenges, duplicate.name);
    }

    if (nextNotes !== primary.notes) updateData.notes = nextNotes;
    if (nextChallenges !== primary.mainChallenges) updateData.mainChallenges = nextChallenges;
    if (Object.keys(updateData).length > 0) {
      await tx.contact.update({ where: { id: primary.id }, data: updateData });
    }

    for (const duplicate of duplicates) {
      for (const identity of duplicate.identities) {
        const conflict = await tx.contactIdentity.findUnique({
          where: { organizationId_type_value: { organizationId: orgId, type: identity.type, value: identity.value } },
          select: { id: true, contactId: true },
        });
        if (!conflict || conflict.id === identity.id) {
          await tx.contactIdentity.update({ where: { id: identity.id }, data: { contactId: primary.id } });
        } else if (conflict.contactId === primary.id) {
          await tx.contactIdentity.delete({ where: { id: identity.id } }).catch(() => null);
        }
      }

      for (const phoneValue of getPhoneIdentityValues(duplicate.phone)) {
        const existing = await tx.contactIdentity.findUnique({
          where: { organizationId_type_value: { organizationId: orgId, type: 'PHONE', value: phoneValue } },
          select: { id: true, contactId: true },
        });
        if (!existing) {
          await tx.contactIdentity.create({ data: { organizationId: orgId, contactId: primary.id, type: 'PHONE', value: phoneValue } });
        } else if (existing.contactId === duplicate.id) {
          await tx.contactIdentity.update({ where: { id: existing.id }, data: { contactId: primary.id } });
        }
      }
      const email = normalizeContactEmail(duplicate.email);
      if (email) {
        const existing = await tx.contactIdentity.findUnique({
          where: { organizationId_type_value: { organizationId: orgId, type: 'EMAIL', value: email } },
          select: { id: true, contactId: true },
        });
        if (!existing) {
          await tx.contactIdentity.create({ data: { organizationId: orgId, contactId: primary.id, type: 'EMAIL', value: email } });
        } else if (existing.contactId === duplicate.id) {
          await tx.contactIdentity.update({ where: { id: existing.id }, data: { contactId: primary.id } });
        }
      }

      if (duplicate.productId && duplicate.productId !== primary.productId) {
        const exists = await tx.contactProduct.findFirst({
          where: { contactId: primary.id, productId: duplicate.productId },
          select: { id: true },
        });
        if (!exists) {
          await tx.contactProduct.create({ data: { contactId: primary.id, productId: duplicate.productId } });
        }
      }

      for (const product of duplicate.contactProducts) {
        const exists = await tx.contactProduct.findFirst({
          where: {
            contactId: primary.id,
            ...(product.productId ? { productId: product.productId } : { customName: product.customName }),
          },
          select: { id: true },
        });
        if (exists) {
          await tx.contactProduct.delete({ where: { id: product.id } });
        } else {
          await tx.contactProduct.update({ where: { id: product.id }, data: { contactId: primary.id } });
        }
      }

      for (const conversation of duplicate.conversations) {
        if (conversation.status === 'OPEN') {
          await tx.message.updateMany({ where: { conversationId: conversation.id }, data: { conversationId: primaryOpenConversation.id } });
          await tx.aIAnalysis.updateMany({ where: { conversationId: conversation.id }, data: { conversationId: primaryOpenConversation.id } });
          await tx.task.updateMany({ where: { conversationId: conversation.id }, data: { conversationId: primaryOpenConversation.id } });
          await tx.scheduledMessage.updateMany({ where: { conversationId: conversation.id }, data: { conversationId: primaryOpenConversation.id } });
          await tx.closedDeal.updateMany({ where: { conversationId: conversation.id }, data: { conversationId: primaryOpenConversation.id } });
          await tx.conversation.delete({ where: { id: conversation.id } });
        } else {
          await tx.conversation.update({ where: { id: conversation.id }, data: { contactId: primary.id } });
        }
      }

      const duplicateDeal = duplicate.closedDeals[0];
      if (duplicateDeal) {
        await tx.closedDeal.update({ where: { id: duplicateDeal.id }, data: { contactId: primary.id } });
      }

      await tx.leadStageHistory.updateMany({ where: { contactId: duplicate.id }, data: { contactId: primary.id } });
      await tx.task.updateMany({ where: { contactId: duplicate.id }, data: { contactId: primary.id } });
      await tx.meeting.updateMany({ where: { contactId: duplicate.id }, data: { contactId: primary.id } });
      await tx.contact.delete({ where: { id: duplicate.id } });
    }

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        userId: workspace.id,
        action: 'CONTACTS_MERGED',
        entity: 'Contact',
        entityId: primary.id,
        metadata: { primaryContactId: primary.id, duplicateContactIds: uniqueDuplicateIds },
      },
    });
  });

  await ensureContactIdentities({ organizationId: orgId, contactId: primary.id, phone: primary.phone, email: primary.email });
  revalidatePath('/contacts');
  revalidatePath('/conversations');
  revalidatePath('/leads');
  revalidatePath('/dashboard');

  return { success: true, merged: uniqueDuplicateIds.length, primaryContactId: primary.id };
}

export type ContactImportField =
  | 'name'
  | 'phone'
  | 'company'
  | 'email'
  | 'interestArea'
  | 'origin'
  | 'notes'
  | 'potentialValue'
  | 'address'
  | 'monthlyRevenue'
  | 'mainChallenges'
  | 'products'
  | 'assignedUser';

export type ContactImportMapping = Record<string, ContactImportField | ''>;

export type ContactImportPreviewRow = {
  line: number;
  status: 'create' | 'update' | 'merge' | 'error';
  values: Partial<Record<ContactImportField, string>>;
  existingContact: { id: string; name: string; phone: string; email: string | null; company: string | null } | null;
  changedFields: string[];
  conflicts: Array<{ field: string; existing: string; incoming: string }>;
  errors: string[];
};

export type ContactImportPreview = {
  headers: string[];
  mappings: ContactImportMapping;
  rows: ContactImportPreviewRow[];
  summary: {
    total: number;
    create: number;
    update: number;
    merge: number;
    errors: number;
    conflicts: number;
  };
};

export type ContactImportResult = {
  created: number;
  updated: number;
  merged: number;
  skipped: number;
  conflicts: { line: number; field: string; existing: unknown; incoming: unknown }[];
  errors: { line: number; reason: string }[];
  rows: Array<{ line: number; status: 'created' | 'updated' | 'merged' | 'skipped' | 'error'; name?: string; phone?: string; reason?: string }>;
  total: number;
};

const CONTACT_IMPORT_FIELDS: ContactImportField[] = [
  'name',
  'phone',
  'company',
  'email',
  'interestArea',
  'origin',
  'notes',
  'potentialValue',
  'address',
  'monthlyRevenue',
  'mainChallenges',
  'products',
  'assignedUser',
];

const CONTACT_IMPORT_HEADER_MAP: Record<string, ContactImportField> = {
  nome: 'name',
  name: 'name',
  cliente: 'name',
  contato: 'name',
  nome_completo: 'name',
  telefone: 'phone',
  phone: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  fone: 'phone',
  empresa: 'company',
  company: 'company',
  companhia: 'company',
  email: 'email',
  e_mail: 'email',
  mail: 'email',
  area_interesse: 'interestArea',
  interesse: 'interestArea',
  interest_area: 'interestArea',
  origem: 'origin',
  origin: 'origin',
  fonte: 'origin',
  observacoes: 'notes',
  observacao: 'notes',
  notas: 'notes',
  notes: 'notes',
  potencial: 'potentialValue',
  valor_potencial: 'potentialValue',
  potential_value: 'potentialValue',
  endereco: 'address',
  address: 'address',
  faturamento_mensal: 'monthlyRevenue',
  monthly_revenue: 'monthlyRevenue',
  faturamento: 'monthlyRevenue',
  desafios: 'mainChallenges',
  principais_desafios: 'mainChallenges',
  main_challenges: 'mainChallenges',
  produto: 'products',
  produtos: 'products',
  product: 'products',
  products: 'products',
  responsavel: 'assignedUser',
  vendedor: 'assignedUser',
  assigned_user: 'assignedUser',
  email_responsavel: 'assignedUser',
};

function normalizeImportHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function autoMapContactImportHeaders(headers: string[]): ContactImportMapping {
  return Object.fromEntries(headers.map((header) => [header, CONTACT_IMPORT_HEADER_MAP[normalizeImportHeader(header)] || ''])) as ContactImportMapping;
}

function getContactImportMappings(headers: string[], rawMappings: FormDataEntryValue | null): ContactImportMapping {
  const mappings = autoMapContactImportHeaders(headers);
  if (typeof rawMappings !== 'string' || !rawMappings.trim()) return mappings;

  const parsed = JSON.parse(rawMappings) as Record<string, unknown>;
  for (const header of headers) {
    const field = parsed[header];
    mappings[header] = typeof field === 'string' && CONTACT_IMPORT_FIELDS.includes(field as ContactImportField) ? field as ContactImportField : '';
  }
  return mappings;
}

async function readContactImportFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });

  if (rawData.length === 0) {
    throw new Error('Planilha vazia.');
  }

  const rows = rawData.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? '').trim()])) as Record<string, string>);
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return { headers, rows };
}

function mapContactImportRow(row: Record<string, string>, mappings: ContactImportMapping) {
  const mapped: Partial<Record<ContactImportField, string>> = {};
  for (const [header, field] of Object.entries(mappings)) {
    if (!field) continue;
    const value = String(row[header] ?? '').trim();
    if (!value) continue;
    const separator = field === 'products' ? ', ' : ' ';
    mapped[field] = mapped[field] ? `${mapped[field]}${separator}${value}` : value;
  }
  return mapped;
}

function parseImportNumber(value: string | undefined) {
  if (!value) return null;
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveImportAssignedUserId(organizationId: string, value: string | undefined) {
  const query = value?.trim();
  if (!query) return null;
  const user = await prisma.user.findFirst({
    where: {
      organizationId,
      OR: [
        { email: { equals: query, mode: 'insensitive' } },
        { name: { equals: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  return user?.id || null;
}

async function attachImportProducts(organizationId: string, contactId: string, value: string | undefined) {
  const names = (value || '').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  for (const name of names) {
    const product = await prisma.product.findFirst({
      where: { organizationId, name: { equals: name, mode: 'insensitive' }, isActive: true },
      select: { id: true },
    });
    if (product) {
      const exists = await prisma.contactProduct.findFirst({ where: { contactId, productId: product.id }, select: { id: true } });
      if (!exists) await prisma.contactProduct.create({ data: { contactId, productId: product.id } });
    } else {
      const exists = await prisma.contactProduct.findFirst({ where: { contactId, customName: name }, select: { id: true } });
      if (!exists) await prisma.contactProduct.create({ data: { contactId, customName: name } });
    }
  }
}

function validateMappedContact(mapped: Partial<Record<ContactImportField, string>>) {
  const errors: string[] = [];
  const name = mapped.name || '';
  const phone = (mapped.phone || '').replace(/\D/g, '');

  if (!name) errors.push('Nome não encontrado.');
  if (!phone) errors.push('Telefone não encontrado ou inválido.');

  return { errors, name, phone };
}

function serializeConflict(conflict: ContactMergeConflict) {
  return {
    field: conflict.field,
    existing: String(conflict.existing ?? ''),
    incoming: String(conflict.incoming ?? ''),
  };
}

function parseIncludedImportLines(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) return null;
  return new Set(parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item)));
}

export async function previewContactsImport(formData: FormData): Promise<ContactImportPreview> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;
  const file = formData.get('file') as File | null;
  if (!file) throw new Error('Nenhum arquivo enviado.');

  const { headers, rows: rawData } = await readContactImportFile(file);
  const mappings = getContactImportMappings(headers, formData.get('mappings'));
  const rows: ContactImportPreviewRow[] = [];
  const summary = { total: rawData.length, create: 0, update: 0, merge: 0, errors: 0, conflicts: 0 };

  for (let i = 0; i < rawData.length; i++) {
    const line = i + 2;
    const mapped = mapContactImportRow(rawData[i], mappings);
    const validation = validateMappedContact(mapped);

    if (validation.errors.length > 0) {
      summary.errors++;
      rows.push({ line, status: 'error', values: mapped, existingContact: null, changedFields: [], conflicts: [], errors: validation.errors });
      continue;
    }

    const assignedUserId = await resolveImportAssignedUserId(orgId, mapped.assignedUser);
    const preview = await previewContactMerge({
      organizationId: orgId,
      name: validation.name,
      phone: validation.phone,
      company: mapped.company,
      email: mapped.email,
      interestArea: mapped.interestArea,
      origin: mapped.origin,
      notes: mapped.notes,
      potentialValue: parseImportNumber(mapped.potentialValue),
      monthlyRevenue: parseImportNumber(mapped.monthlyRevenue),
      address: mapped.address,
      mainChallenges: mapped.mainChallenges,
      assignedUserId,
      source: `Prévia ${file.name}`,
    });

    const status = preview.created ? 'create' : preview.changedFields.length > 0 ? 'update' : 'merge';
    summary[status]++;
    summary.conflicts += preview.conflicts.length;
    rows.push({
      line,
      status,
      values: mapped,
      existingContact: preview.contact ? {
        id: preview.contact.id,
        name: preview.contact.name,
        phone: preview.contact.phone,
        email: preview.contact.email,
        company: preview.contact.company,
      } : null,
      changedFields: preview.changedFields,
      conflicts: preview.conflicts.map(serializeConflict),
      errors: [],
    });
  }

  return { headers, mappings, rows, summary };
}

export async function importContactsFromFile(formData: FormData): Promise<ContactImportResult> {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;
  const file = formData.get('file') as File | null;
  if (!file) throw new Error('Nenhum arquivo enviado.');

  const { headers, rows: rawData } = await readContactImportFile(file);
  const mappings = getContactImportMappings(headers, formData.get('mappings'));
  const includedLines = parseIncludedImportLines(formData.get('includedLines'));

  let created = 0;
  let updated = 0;
  let merged = 0;
  let skipped = 0;
  const conflicts: { line: number; field: string; existing: unknown; incoming: unknown }[] = [];
  const errors: { line: number; reason: string }[] = [];
  const rows: ContactImportResult['rows'] = [];

  for (let i = 0; i < rawData.length; i++) {
    const line = i + 2;
    if (includedLines && !includedLines.has(line)) {
      skipped++;
      rows.push({ line, status: 'skipped' });
      continue;
    }

    try {
      const mapped = mapContactImportRow(rawData[i], mappings);
      const validation = validateMappedContact(mapped);
      if (validation.errors.length > 0) {
        const reason = validation.errors.join(' ');
        errors.push({ line, reason });
        rows.push({ line, status: 'error', name: validation.name, phone: validation.phone, reason });
        continue;
      }

      const result = await resolveOrCreateContact({
        organizationId: orgId,
        name: validation.name,
        phone: validation.phone,
        company: mapped.company,
        email: mapped.email,
        interestArea: mapped.interestArea,
        origin: mapped.origin,
        notes: mapped.notes,
        potentialValue: parseImportNumber(mapped.potentialValue),
        monthlyRevenue: parseImportNumber(mapped.monthlyRevenue),
        address: mapped.address,
        mainChallenges: mapped.mainChallenges,
        assignedUserId: await resolveImportAssignedUserId(orgId, mapped.assignedUser),
        source: `Importação ${file.name}`,
      });

      await attachImportProducts(orgId, result.contact.id, mapped.products);
      if (result.created) {
        created++;
        rows.push({ line, status: 'created', name: result.contact.name, phone: result.contact.phone });
      } else if (result.changedFields.length > 0) {
        updated++;
        rows.push({ line, status: 'updated', name: result.contact.name, phone: result.contact.phone });
      } else {
        merged++;
        rows.push({ line, status: 'merged', name: result.contact.name, phone: result.contact.phone });
      }

      for (const conflict of result.conflicts) {
        conflicts.push({ line, ...conflict });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Erro desconhecido.';
      errors.push({ line, reason });
      rows.push({ line, status: 'error', reason });
    }
  }

  revalidatePath('/contacts');
  revalidatePath('/conversations');

  return { created, updated, merged, skipped, conflicts, errors, rows, total: rawData.length };
}

async function fetchFilteredDeals(filters?: ReportsFilters) {
  const workspace = await ensurePaidWorkspace();
  const orgId = workspace.organizationId;
  const targetUserId = workspace.role === 'owner' ? filters?.userId : workspace.id;
  const productFilter = filters?.productId || undefined;
  const { from, to } = getReportDateRange(filters);

  const dealWhere: any = {
    organizationId: orgId,
    closedAt: { gte: from, lte: to },
  };
  if (targetUserId) dealWhere.closedByUserId = targetUserId;

  const deals = await prisma.closedDeal.findMany({
    where: dealWhere,
    orderBy: { closedAt: 'asc' },
    include: {
      contact: { select: { name: true } },
    },
  });

  if (!productFilter) return deals;
  return deals.filter((deal) => {
    const products = getClosedDealProductsFromJson(deal.productsJson);
    return products.some((p) => p.productId === productFilter);
  });
}

function computeFirstPaymentDate(closedAt: Date, day: number | null): Date {
  if (!day || day < 1) return closedAt;
  const candidate = new Date(closedAt.getFullYear(), closedAt.getMonth(), day);
  if (candidate > closedAt) return candidate;
  const next = new Date(closedAt.getFullYear(), closedAt.getMonth() + 1, day);
  if (next.getMonth() > (closedAt.getMonth() + 1) % 12) {
    return new Date(closedAt.getFullYear(), closedAt.getMonth() + 2, 0);
  }
  return next;
}

function computeFirstPaymentValue(totalValue: number, installmentCount: number | null, hasSignal: boolean, signalValue: number | null): number {
  if (hasSignal) return signalValue ?? 0;
  if (installmentCount && installmentCount > 0) return totalValue / installmentCount;
  return totalValue;
}

export type DealExportRow = {
  nome: string;
  valorTotal: number;
  dataPrimeiroPagamento: string;
  valorPrimeiroPagamento: number;
  sinal: number;
  parcelas: number;
  tempo: string;
};

export async function exportReportXlsx(filters?: ReportsFilters): Promise<string> {
  const deals = await fetchFilteredDeals(filters);
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');

  const rows = deals.map((deal) => {
    const fpDate = deal.hasSignal ? deal.closedAt : computeFirstPaymentDate(deal.closedAt, deal.firstPaymentDate);
    const fpValue = computeFirstPaymentValue(deal.totalValue, deal.installmentCount, deal.hasSignal, deal.signalValue);
    return {
      Nome: deal.contact.name,
      'Valor total': Number(deal.totalValue.toFixed(2)),
      'Data 1o pagamento': fmtDate(fpDate),
      'Valor 1o pagamento': Number(fpValue.toFixed(2)),
      Sinal: deal.hasSignal ? Number((deal.signalValue || 0).toFixed(2)) : 0,
      'Total de parcelas': deal.installmentCount || 1,
      'Tempo de projeto': deal.projectDuration || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer.toString('base64');
}

export async function exportReportCsv(filters?: ReportsFilters): Promise<string> {
  const deals = await fetchFilteredDeals(filters);
  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');

  const rows = deals.map((deal) => {
    const fpDate = deal.hasSignal ? deal.closedAt : computeFirstPaymentDate(deal.closedAt, deal.firstPaymentDate);
    const fpValue = computeFirstPaymentValue(deal.totalValue, deal.installmentCount, deal.hasSignal, deal.signalValue);
    return {
      Nome: deal.contact.name,
      'Valor total': Number(deal.totalValue.toFixed(2)),
      'Data 1o pagamento': fmtDate(fpDate),
      'Valor 1o pagamento': Number(fpValue.toFixed(2)),
      Sinal: deal.hasSignal ? Number((deal.signalValue || 0).toFixed(2)) : 0,
      'Total de parcelas': deal.installmentCount || 1,
      'Tempo de projeto': deal.projectDuration || '',
    };
  });

  const header = Object.keys(rows[0] || {}).join(',');
  const body = rows.map((row) => Object.values(row).map((v) => `"${v}"`).join(',')).join('\n');
  return header + '\n' + body;
}

export async function fetchReportDeals(filters?: ReportsFilters): Promise<DealExportRow[]> {
  const deals = await fetchFilteredDeals(filters);
  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');

  return deals.map((deal) => {
    const fpDate = deal.hasSignal ? deal.closedAt : computeFirstPaymentDate(deal.closedAt, deal.firstPaymentDate);
    const fpValue = computeFirstPaymentValue(deal.totalValue, deal.installmentCount, deal.hasSignal, deal.signalValue);
    return {
      nome: deal.contact.name,
      valorTotal: deal.totalValue,
      dataPrimeiroPagamento: fmtDate(fpDate),
      valorPrimeiroPagamento: fpValue,
      sinal: deal.hasSignal ? (deal.signalValue || 0) : 0,
      parcelas: deal.installmentCount || 1,
      tempo: deal.projectDuration || '',
    };
  });
}
