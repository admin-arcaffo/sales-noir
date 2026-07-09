"use client";

import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Pencil,
  Phone,
  Play,
  Pause,
  Volume2,
  Save,
  Search,
  Send,
  ShieldAlert,
  Smile,
  Target,
  TrendingUp,
  Zap,
  CheckCheck,
  Trash2,
  Check,
  CheckCircle2,
  Square,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Filter,
  Tag,
  UserPlus,
  User,
  Plus,
  RefreshCw,
  Calendar,
  MapPin,
  Mail,
  Share2,
  Sparkles,
  Loader2,
  Clock,
} from "lucide-react";
import {
  getConversations,
  sendConversationMessage,
  updateConversationStage,
  deleteOutboundMessage,
  editOutboundMessage,
  sendMessageReaction,
  getWhatsAppProfile,
  updateWhatsAppProfile,
  syncSingleConversation,
  getContactProfile,
  updateContactProfile,
  updateConversationTemperature,
  getProducts,
  getLeadOrigins,
  startNewConversation,
  getPipelineStages,
  syncAfterReconnect,
  forwardMessages,
  deleteConversation,
  type ConversationAnalysisData,
  type ConversationData,
  type ConversationMessage,
  type ProductData,
  type PipelineStageData,
  updateContactAddress,
  updateContactEmail,
  resolveGoogleMapsAddress,
  getQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
  type QuickReplyData,
  getTasks,
  toggleTaskStatus,
  type TaskData,
  getOrganizationUsers,
} from "@/actions/crm";
import type { AnalysisResponse } from "@/lib/ai/prompts";
import { MessageTime } from "./_components/MessageTime";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { temperatureDotClasses } from "@/components/ui/noir";
import { useFloatingChat } from "@/context/FloatingChatContext";
import { CHAT_CACHE_INVALIDATED_EVENT, clearChatCache } from "@/lib/chat-cache";
import { normalizeOutboundMediaInput } from "@/lib/outbound-media";
import { SmartText } from "@/components/ui/SmartText";
import { detectAll, type DetectedEntity } from "@/lib/detect-entities";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
const MeetingModal = lazy(() => import("@/app/(app)/_components/MeetingModal").then((module) => ({ default: module.MeetingModal })));
const QuoteEditor = lazy(() => import("@/app/(app)/_components/QuoteEditor").then((module) => ({ default: module.QuoteEditor })));
const TaskModal = lazy(() => import("@/app/(app)/_components/TaskModal").then((module) => ({ default: module.TaskModal })));
const ClosedDealModal = lazy(() => import("@/components/modals/ClosedDealModal").then((module) => ({ default: module.ClosedDealModal })));
const InviteMasterclassModal = lazy(() => import("@/components/modals/InviteMasterclassModal").then((module) => ({ default: module.InviteMasterclassModal })));

const STATUS_COLORS = temperatureDotClasses;

const LEGACY_STAGE_LABELS: Record<string, string> = {
  PRIMEIRO_CONTATO: "Primeiro Contato",
  QUALIFICACAO: "Qualificação",
  APRESENTACAO_PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  OBJECAO: "Objeção",
  FOLLOW_UP: "Follow-up",
  FECHAMENTO: "Fechamento",
  REATIVACAO: "Reativação",
};

const getStageDisplay = (stage: string | null | undefined): string => {
  if (!stage) return "-";
  return LEGACY_STAGE_LABELS[stage] || stage;
};

function normalizeStageText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isClosedDealStage(value: string) {
  const normalized = normalizeStageText(value);
  return normalized.includes("fechamento") || normalized.includes("negocio fechado") || normalized.includes("negocios fechados") || normalized.includes("contrato fechado");
}

function isMediaMessageType(type: string) {
  return ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"].includes(type);
}

function isTemporaryWhatsAppMediaUrl(value?: string | null) {
  if (!value) return false;
  return value.includes("pps.whatsapp.net") || value.includes("mmg.whatsapp.net") || value.includes(".whatsapp.net/v/");
}

const DIRECT_MEDIA_UPLOAD_LIMIT = 4 * 1024 * 1024;

export type SmartEntity = {
  type: 'address' | 'email' | 'maps_link' | 'phone' | 'url';
  value: string;
  phoneNormalized?: string;
};

export const extractSmartEntities = (text: string): SmartEntity[] => {
  const entities: SmartEntity[] = [];
  if (!text) return entities;

  const detected = detectAll(text);

  for (const d of detected) {
    if (d.type === 'email') {
      if (!entities.some(e => e.type === 'email' && e.value === d.value)) {
        entities.push({ type: 'email', value: d.value });
      }
    } else if (d.type === 'url') {
      const isMaps = /google\.com\/maps|maps\.app\.goo\.gl|g\.page/i.test(d.value);
      if (isMaps) {
        if (!entities.some(e => e.type === 'maps_link')) {
          entities.push({ type: 'maps_link', value: d.value });
        }
      } else {
        if (!entities.some(e => e.type === 'url' && e.value === d.value)) {
          entities.push({ type: 'url', value: d.value });
        }
      }
    } else if (d.type === 'phone') {
      if (!entities.some(e => e.type === 'phone' && e.value === d.value)) {
        entities.push({ type: 'phone', value: d.value, phoneNormalized: d.phoneNormalized });
      }
    }
  }

  return entities.slice(0, 4);
};

function formatDateTimeInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDueAtFromTimeWindow(timeWindow?: string | null) {
  if (!timeWindow) return "";

  const value = timeWindow.toLowerCase();
  const date = new Date();

  if (value.includes("amanh")) {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return formatDateTimeInput(date);
  }

  if (value.includes("hoje")) {
    date.setHours(Math.max(date.getHours() + 2, 18), 0, 0, 0);
    return formatDateTimeInput(date);
  }

  const hourMatch = value.match(/(\d+)\s*(h|hora|horas)/);
  if (hourMatch) {
    date.setHours(date.getHours() + Number(hourMatch[1]));
    return formatDateTimeInput(date);
  }

  const dayMatch = value.match(/(\d+)\s*(d|dia|dias)/);
  if (dayMatch) {
    date.setDate(date.getDate() + Number(dayMatch[1]));
    date.setHours(9, 0, 0, 0);
    return formatDateTimeInput(date);
  }

  if (value.includes("semana")) {
    date.setDate(date.getDate() + 7);
    date.setHours(9, 0, 0, 0);
    return formatDateTimeInput(date);
  }

  return "";
}

function mergeConversationMessages(existing: ConversationMessage[], incoming: ConversationMessage[]) {
  const messageMap = new Map(existing.map((message) => [message.id, message]));

  incoming.forEach((message) => {
    const previous = messageMap.get(message.id);
    const incomingMediaUrl = message.mediaUrl && !isTemporaryWhatsAppMediaUrl(message.mediaUrl) ? message.mediaUrl : null;
    const previousMediaUrl = previous?.mediaUrl && !isTemporaryWhatsAppMediaUrl(previous.mediaUrl) ? previous.mediaUrl : null;
    messageMap.set(message.id, {
      ...previous,
      ...message,
      mediaUrl: incomingMediaUrl ?? previousMediaUrl ?? null,
    });
  });

  return Array.from(messageMap.values()).sort((a, b) => (
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ));
}

function mergeConversationData(existing: ConversationData, incoming: ConversationData): ConversationData {
  return {
    ...existing,
    ...incoming,
    latestAnalysis: incoming.latestAnalysis ?? existing.latestAnalysis,
    contactProducts: incoming.contactProducts ?? existing.contactProducts,
    messages: mergeConversationMessages(existing.messages, incoming.messages),
  };
}

function stripTemporaryConversationMediaUrls(conversations: ConversationData[]) {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      mediaUrl: isTemporaryWhatsAppMediaUrl(message.mediaUrl) ? null : message.mediaUrl,
    })),
  }));
}

const CustomAudioPlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error("Audio playback failed:", err));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    // Evita valores infinitos ou inválidos de metadados
    if (isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    audioRef.current.currentTime = percentage * duration;
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [src]);

  // Se o áudio carregar a duração depois
  useEffect(() => {
    if (audioRef.current && isFinite(audioRef.current.duration) && duration === 0) {
      setDuration(audioRef.current.duration);
    }
  });

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 bg-zinc-900/60 backdrop-blur-sm border border-white/[0.04] rounded-xl p-2.5 min-w-[240px] max-w-[280px] shadow-lg relative select-none mb-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition-all active:scale-95 shadow-md shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-black text-black" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-black text-black ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* Progress Bar */}
        <div
          onClick={handleSeek}
          className="h-1.5 w-full bg-zinc-800 hover:bg-zinc-700/80 rounded-full cursor-pointer relative overflow-hidden transition-colors"
        >
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-emerald-500 rounded-full transition-all duration-75"
          />
        </div>

        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 hidden sm:block" />
    </div>
  );
};

const SafeAvatar = ({ src, alt, className }: { src?: string | null, alt?: string, className?: string }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 dark:bg-zinc-800 text-gray-500 font-medium ${className}`}>
        {alt ? alt.charAt(0).toUpperCase() : "?"}
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt || "Avatar"} 
      className={className} 
      onError={() => setError(true)} 
    />
  );
};


export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSyncingConvo, setIsSyncingConvo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sellerContext, setSellerContext] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasAppliedConversationParamRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [draftMessage]);
  const [draftStage, setDraftStage] = useState("PRIMEIRO_CONTATO");
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncTimeRef = useRef<string | null>(null);
  const lastSyncTimeMapRef = useRef<Record<string, number>>({});
  
  // Custom sidebar metadata dropdown states
  const [products, setProducts] = useState<ProductData[]>([]);
  const [leadOrigins, setLeadOrigins] = useState<{ id: string; name: string }[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageData[]>([]);
  const [organizationUsers, setOrganizationUsers] = useState<any[]>([]);
  const [draftProducts, setDraftProducts] = useState<string[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [draftOrigin, setDraftOrigin] = useState("");
  const [isSavingOrigin, setIsSavingOrigin] = useState(false);
  const [isSavingTemp, setIsSavingTemp] = useState(false);

  // Scheduled Messages States
  const [scheduleGlobalDate, setScheduleGlobalDate] = useState("");
  const [scheduleGlobalTime, setScheduleGlobalTime] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState([{ id: Date.now().toString(), content: "" }]);
  const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [quotingMessage, setQuotingMessage] = useState<any>(null);
  const { showToast } = useToast();

  // Unread messages tracking
  const chatContext = useFloatingChat();
  const lastReadMap = chatContext?.lastReadMap || {};
  const setLastReadMap = chatContext?.setLastReadMap || (() => {});
  const [connectionStatus, setConnectionStatus] = useState<string>("CONNECTED");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [availableConnections, setAvailableConnections] = useState<{ id: string; name: string }[]>([]);
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [cacheInvalidationVersion, setCacheInvalidationVersion] = useState(0);

  // Nova Conversa modal states
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatInitialMessage, setNewChatInitialMessage] = useState("");
  const [isSubmittingNewChat, setIsSubmittingNewChat] = useState(false);
  
  // Quick Replies states
  const [quickReplies, setQuickReplies] = useState<QuickReplyData[]>([]);
  const [isQuickRepliesModalOpen, setIsQuickRepliesModalOpen] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState("");
  const [filteredQuickReplies, setFilteredQuickReplies] = useState<QuickReplyData[]>([]);
  const [activeQuickReplyIndex, setActiveQuickReplyIndex] = useState(0);
  const [showQuickReplyDropdown, setShowQuickReplyDropdown] = useState(false);
  const [pendingClosedDeal, setPendingClosedDeal] = useState<{ leadId: string; newStage: string; newStageLabel: string } | null>(null);
  const [inviteMasterclassLeadId, setInviteMasterclassLeadId] = useState<string | null>(null);
  const quickReplyDropdownRef = useRef<HTMLDivElement>(null);

  // Sincronização pós-reconexão
  const [isSyncing, setIsSyncing] = useState(false);
  const prevConnectionStatusRef = useRef<string | null>(null);

  // Forward Mode States
  const [forwardMode, setForwardMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardQuery, setForwardQuery] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);
  const [activeTab, setActiveTab] = useState<"ativos" | "aguardando" | "arquivados">("ativos");
  const [tacticalTab, setTacticalTab] = useState<"lead" | "ia" | "tasks" | "acoes">("lead");

  // Edit Contact Name states
  const [isEditingContactName, setIsEditingContactName] = useState(false);
  const [editedContactNameValue, setEditedContactNameValue] = useState("");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editedCompanyValue, setEditedCompanyValue] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmailValue, setEditedEmailValue] = useState("");
  const [isEditingInterestArea, setIsEditingInterestArea] = useState(false);
  const [editedInterestAreaValue, setEditedInterestAreaValue] = useState("");

  // Smart Filter states
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");

  // Helper: Format message day label
  const getMessageDateString = (timestampStr: string): string => {
    try {
      const date = new Date(timestampStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return "Hoje";
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Ontem";
      } else {
        return new Intl.DateTimeFormat('pt-BR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).format(date);
      }
    } catch (e) {
      return "";
    }
  };

  // Helper: Count unread inbound messages for a conversation
  const getUnreadCount = (convo: ConversationData): number => {
    if (convo.id === selectedConvo) return 0;
    const lastRead = lastReadMap[convo.id];
    if (!lastRead) {
      const lastMsg = convo.messages[convo.messages.length - 1];
      return (lastMsg && lastMsg.direction === 'inbound') ? 1 : 0;
    }
    
    const lastReadTime = new Date(lastRead).getTime();
    return convo.messages.filter(m => 
      m.direction === 'inbound' && 
      new Date(m.timestamp).getTime() > lastReadTime
    ).length;
  };

  // Update document title with unread count
  useEffect(() => {
    const totalUnread = conversations.reduce((acc, convo) => acc + getUnreadCount(convo), 0);
    const baseTitle = "Chat | Dealeto";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${baseTitle}` : baseTitle;
  }, [conversations, lastReadMap, selectedConvo]);

  // Load cached conversations and last read map from localStorage on mount for instant visual load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("sales_arcaffo_conversations");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConversations(stripTemporaryConversationMediaUrls(parsed));
            setIsLoading(false);
          }
        }
        
        // the lastReadMap is now handled by the FloatingChatContext
      } catch (e) {
        console.error("Failed to load cached conversations from localStorage", e);
      }
    }
  }, []);

  // Check scheduled notifications on a timer
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(() => {
      void checkScheduledNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useKeyboardShortcuts({
    onEscape: () => {
      if (isScheduleOpen) setIsScheduleOpen(false);
      else if (isContactProfileModalOpen) setIsContactProfileModalOpen(false);
    },
    onSend: () => void handleSendMessage(),
    onSearch: () => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Buscar"]')?.focus();
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleInvalidation = () => {
      clearChatCache();
      lastSyncTimeRef.current = null;
      lastSyncTimeMapRef.current = {};
      hasAppliedConversationParamRef.current = false;
      setConversations([]);
      setSelectedConvo(null);
      setIsLoading(true);
      setCacheInvalidationVersion((version) => version + 1);
    };

    window.addEventListener(CHAT_CACHE_INVALIDATED_EVENT, handleInvalidation);
    return () => window.removeEventListener(CHAT_CACHE_INVALIDATED_EVENT, handleInvalidation);
  }, []);

  // Manage parent layout sidebar visibility on mobile
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedConvo) {
        document.documentElement.classList.add("has-active-chat");
      } else {
        document.documentElement.classList.remove("has-active-chat");
      }
    }
    return () => {
      if (typeof window !== "undefined") {
        document.documentElement.classList.remove("has-active-chat");
      }
    };
  }, [selectedConvo, selectedConnectionId]);

  // Saving lastReadMap to localStorage is now handled by FloatingChatContext

  // Mark active/selected conversation as read
  useEffect(() => {
    if (selectedConvo && conversations.length > 0) {
      const active = conversations.find(c => c.id === selectedConvo);
      if (active && active.messages.length > 0) {
        setLastReadMap(prev => {
          const next = { ...prev, [selectedConvo]: new Date().toISOString() };
          return next;
        });
      }
    }
  }, [selectedConvo, conversations]);

  // Save to localStorage whenever conversations state updates (optimistic updates, polling sync, stages, notes)
  useEffect(() => {
    if (conversations.length > 0 && typeof window !== "undefined") {
      try {
        // Enormously reduce storage footprint by only caching the last 5 messages per conversation
        // and limiting cache to the 30 most recent conversations to avoid QuotaExceededError
        const cacheFriendlyList = conversations.slice(0, 30).map(c => ({
          ...c,
          messages: c.messages.slice(-5)
        }));
        localStorage.setItem("sales_arcaffo_conversations", JSON.stringify(cacheFriendlyList));
      } catch (e) {
        console.warn("Storage quota exceeded or error occurred while writing to localStorage", e);
        // Fallback: If still full, try only caching metadata (no messages at all)
        try {
          const metadataOnlyList = conversations.map(c => ({
            ...c,
            messages: []
          }));
          localStorage.setItem("sales_arcaffo_conversations", JSON.stringify(metadataOnlyList));
        } catch (innerErr) {
          console.error("Failed to store even metadata in localStorage", innerErr);
        }
      }
    }
  }, [conversations]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Estados de Gravação de Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: string; text: string } | null>(null);
  const [reactionPicker, setReactionPicker] = useState<string | null>(null); // msgId
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isContactProfileModalOpen, setIsContactProfileModalOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isShareContactModalOpen, setIsShareContactModalOpen] = useState(false);
  const [shareContactSearchQuery, setShareContactSearchQuery] = useState("");
  const [isSharingContact, setIsSharingContact] = useState(false);
  const [leadTasks, setLeadTasks] = useState<TaskData[]>([]);
  const [isLoadingLeadTasks, setIsLoadingLeadTasks] = useState(false);
  const [taskModal, setTaskModal] = useState<{
    contactId: string;
    contactName: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultType?: string;
    defaultPriority?: string;
    defaultDueAt?: string;
    defaultSource?: string;
    defaultConversationId?: string | null;
    defaultAnalysisId?: string | null;
  } | null>(null);
  
  // Estados de Colapso das Áreas
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileCollapsed, setIsProfileCollapsed] = useState(false);
  const [isAnalysisCollapsed, setIsAnalysisCollapsed] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);

  useEffect(() => {
    getQuickReplies().then(setQuickReplies).catch(console.error);
    
    // Auto-collapse analysis panel on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsAnalysisCollapsed(true);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  const activeConvo = conversations.find((conversation) => conversation.id === selectedConvo) || null;

  const openTaskModal = (defaults?: {
    title?: string;
    description?: string;
    type?: string;
    priority?: string;
    dueAt?: string;
    source?: string;
    analysisId?: string | null;
  }) => {
    if (!activeConvo) return;

    setTaskModal({
      contactId: activeConvo.contactId,
      contactName: activeConvo.name,
      defaultTitle: defaults?.title || "",
      defaultDescription: defaults?.description || "",
      defaultType: defaults?.type || "FOLLOW_UP",
      defaultPriority: defaults?.priority || "MEDIUM",
      defaultDueAt: defaults?.dueAt || "",
      defaultSource: defaults?.source || "MANUAL",
      defaultConversationId: activeConvo.id,
      defaultAnalysisId: defaults?.analysisId || null,
    });
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConvo?.messages.length, selectedConvo]);

  useEffect(() => {
    let alive = true;

    if (!activeConvo?.contactId) {
      setLeadTasks([]);
      return;
    }

    setIsLoadingLeadTasks(true);
    getTasks({ contactId: activeConvo.contactId })
      .then((tasks) => {
        if (alive) setLeadTasks(tasks);
      })
      .catch((error) => console.error("Failed to load lead tasks:", error))
      .finally(() => {
        if (alive) setIsLoadingLeadTasks(false);
      });

    return () => {
      alive = false;
    };
  }, [activeConvo?.contactId]);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setReactionPicker(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const toggleSelection = (msgId: string) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleForwardExecute = async (targetConversationId: string) => {
    if (selectedMsgIds.size === 0) return;
    setIsForwarding(true);
    try {
      const { forwardMessages } = await import("@/actions/crm");
      const res = await forwardMessages(Array.from(selectedMsgIds), targetConversationId);
      if (res.success) {
        setForwardMode(false);
        setSelectedMsgIds(new Set());
        setIsForwardModalOpen(false);
        
        // Optimistic UI change to jump to target convo
        const targetConvo = conversations.find(c => c.id === targetConversationId);
        if (targetConvo) {
          selectConversation(targetConvo.id, conversations);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Falha ao encaminhar mensagens.", "error");
    } finally {
      setIsForwarding(false);
    }
  };

  const formatDateTimeLocal = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  
  const checkScheduledNotifications = async () => {
    try {
      const { getUnnotifiedScheduledMessages, markScheduledMessagesAsNotified } = await import("@/actions/crm");
      const unnotified = await getUnnotifiedScheduledMessages();
      if (unnotified && unnotified.length > 0) {
        for (const msg of unnotified) {
          showToast(`Mensagem agendada enviada para ${msg.conversation.contact.name}: "${msg.content.substring(0, 30)}..."`);
        }
        const ids = unnotified.map(m => m.id);
        await markScheduledMessagesAsNotified(ids);
      }
    } catch (err) {
      console.error("Failed to check scheduled notifications", err);
    }
  };

  const loadScheduledMessages = async (convoId: string) => {
    try {
      const { getScheduledMessages } = await import("@/actions/crm");
      const list = await getScheduledMessages(convoId);
      setPendingSchedules(list || []);
      setScheduledMessages([{ id: Date.now().toString(), content: "" }]);
      setEditingScheduleId(null);
      setScheduleGlobalDate("");
      setScheduleGlobalTime("");
    } catch (err) {
      console.error("Failed to load scheduled messages", err);
    }
  };

  const handleEditSchedule = (schedule: any) => {
    setEditingScheduleId(schedule.id);
    setScheduledMessages([{ id: Date.now().toString(), content: schedule.content }]);
    const d = new Date(schedule.scheduledFor);
    setScheduleGlobalDate(d.toISOString().split("T")[0]);
    setScheduleGlobalTime(d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  };

  const handleSaveSchedule = async () => {
    if (!selectedConvo) return;
    setIsSavingSchedule(true);
    try {
      const { scheduleMessages } = await import("@/actions/crm");
      
      if (!scheduleGlobalDate || !scheduleGlobalTime) {
        showToast("Preencha a data e hora globais para o agendamento.", "error");
        setIsSavingSchedule(false);
        return;
      }

      const validMessages = scheduledMessages.filter(item => item.content.trim());
      if (validMessages.length === 0) {
        showToast("Preencha ao menos uma mensagem para agendar.", "error");
        setIsSavingSchedule(false);
        return;
      }

      // Cria a data usando o fuso horário local do navegador/dispositivo
      // new Date() sem 'Z' interpreta no fuso local do runtime (browser), o que é correto.
      // Adicionamos logging para debug e validação contra datas no passado.
      const browserTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const baseDate = new Date(`${scheduleGlobalDate}T${scheduleGlobalTime}:00`);
      
      console.log(`[Schedule] Browser TZ: ${browserTZ}, Local: ${baseDate.toString()}, UTC: ${baseDate.toISOString()}`);

      if (baseDate.getTime() <= Date.now()) {
        showToast("A data e hora devem ser no futuro. Ajuste o agendamento.", "error");
        setIsSavingSchedule(false);
        return;
      }
      
      const messagesToSchedule = validMessages.map((item, index) => {
        // Adds 2 seconds delay per message
        const scheduledFor = new Date(baseDate.getTime() + index * 2000);
        return {
          content: item.content.trim(),
          scheduledFor
        };
      });
      
      if (editingScheduleId) {
        const { cancelScheduledMessage } = await import("@/actions/crm");
        await cancelScheduledMessage(editingScheduleId);
      }

      await scheduleMessages(selectedConvo, messagesToSchedule);
      showToast(editingScheduleId ? "Agendamento editado com sucesso!" : "Agendamento salvo com sucesso!", "success");
      setEditingScheduleId(null);
      void loadScheduledMessages(selectedConvo);
      setIsScheduleOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Erro ao salvar agendamento.", "error");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    try {
      const { cancelScheduledMessage } = await import("@/actions/crm");
      await cancelScheduledMessage(id);
      if (selectedConvo) void loadScheduledMessages(selectedConvo);
    } catch (err: any) {
      showToast("Erro ao cancelar: " + err.message, "error");
    }
  };

  const handleToggleLeadTask = async (task: TaskData) => {
    try {
      const updated = await toggleTaskStatus(task.id, task.status);
      setLeadTasks((current) => current.map((item) => (
        item.id === task.id
          ? { ...item, status: updated.status }
          : item
      )));
    } catch (error) {
      console.error("Failed to toggle task:", error);
      showToast("Não foi possível atualizar a tarefa.", "error");
    }
  };

  const selectConversation = (conversationId: string, source: ConversationData[]) => {
    const conversation = source.find((item) => item.id === conversationId);
    setSelectedConvo(conversationId);
    chatContext.openFloatingConversation(conversationId, source);
    setDraftStage(conversation?.stageKey || "PRIMEIRO_CONTATO");
    setNotesDraft(conversation?.notes || "");
    setDraftProducts(conversation?.productIds || []);
    setDraftOrigin(conversation?.origin || "");
    setAnalysisResult(conversation?.latestAnalysis || null);
    setDraftMessage("");

    // Load scheduled messages for this conversation
    void loadScheduledMessages(conversationId);

    // Intelligent On-Demand Sync (20s cooldown)
    const now = Date.now();
    const lastSync = lastSyncTimeMapRef.current[conversationId] || 0;
    if (now - lastSync > 20000) {
      setIsSyncingConvo(true);
      void (async () => {
        try {
          const syncResult = await syncSingleConversation(conversationId);
          if (syncResult && syncResult.success && syncResult.newMessages > 0) {
            const resultData = await getConversations(undefined, selectedConnectionId, { messageLimit: 50, runMaintenance: false, assignedToMe });
            setConversations(resultData.conversations);
          }
        } catch (e) {
          console.error("Background sync failed:", e);
        } finally {
          lastSyncTimeMapRef.current[conversationId] = Date.now();
          setIsSyncingConvo(false);
        }
      })();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || conversations.length === 0) return;
    if (hasAppliedConversationParamRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const requestedConversationId = urlParams.get("conversationId");
    const requestedContactId = urlParams.get("contactId");
    
    if (!requestedConversationId && !requestedContactId) return;

    let targetConversationId = requestedConversationId;

    if (!targetConversationId && requestedContactId) {
      const convoByContact = conversations.find(c => c.contactId === requestedContactId);
      if (convoByContact) {
        targetConversationId = convoByContact.id;
      }
    }

    if (!targetConversationId) return;

    if (selectedConvo === targetConversationId) {
      hasAppliedConversationParamRef.current = true;
      return;
    }
    
    if (!conversations.some((conversation) => conversation.id === targetConversationId)) return;

    hasAppliedConversationParamRef.current = true;
    selectConversation(targetConversationId, conversations);
  }, [conversations, selectedConvo]);

  const handleSaveContactName = async () => {
    if (!editedContactNameValue.trim() || !activeConvo) return;
    setIsEditingContactName(false);
    const previousConversations = [...conversations];
    
    // Optimistic Update
    setConversations(current => current.map(c => {
      if (c.contactId === activeConvo.contactId) {
        return {
          ...c,
          name: editedContactNameValue.trim(),
          initials: editedContactNameValue.trim().substring(0, 2).toUpperCase()
        };
      }
      return c;
    }));
    
    try {
      await updateContactProfile(activeConvo.contactId, { name: editedContactNameValue.trim() });
    } catch (e) {
      setConversations(previousConversations);
      showToast("Erro ao salvar nome do contato.", "error");
    }
  };

  const handleSaveContactField = async (field: 'company' | 'email' | 'interestArea' | 'assignedUserId' | 'closerId', value: string) => {
    if (!activeConvo) return;
    const previousConversations = [...conversations];

    const finalValue = value.trim() || null;

    // Optimistic Update
    setConversations(current => current.map(c => {
      if (c.contactId === activeConvo.contactId) {
        if (field === 'assignedUserId') {
           const userName = finalValue ? organizationUsers.find(u => u.id === finalValue)?.name || null : null;
           return { ...c, assignedUserId: finalValue, assignedUserName: userName };
        }
        if (field === 'closerId') {
           const userName = finalValue ? organizationUsers.find(u => u.id === finalValue)?.name || null : null;
           return { ...c, closerId: finalValue, closerName: userName };
        }
        return { ...c, [field]: finalValue };
      }
      return c;
    }));
    
    try {
      await updateContactProfile(activeConvo.contactId, { [field]: finalValue });
    } catch (e) {
      setConversations(previousConversations);
      showToast(`Erro ao salvar campo.`, "error");
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setDraftMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleStartChatWithPhone = async (phone: string, name: string) => {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      if (!cleanPhone) {
        showToast("Número de telefone inválido.", "error");
        return;
      }
      setIsSubmittingNewChat(true);
      const result = await startNewConversation(name, cleanPhone);
      if (result.success && result.conversationId) {
        // Fetch new lists
        const resultData = await getConversations();
        setConversations(resultData.conversations);
        
        // Select newly created conversation
        selectConversation(result.conversationId, resultData.conversations);
        
        // Close modal just in case
        setIsNewChatModalOpen(false);
        setNewChatName("");
        setNewChatPhone("");
        setNewChatInitialMessage("");
      }
    } catch (e: any) {
      showToast(e?.message || "Erro ao iniciar conversa.", "error");
    } finally {
      setIsSubmittingNewChat(false);
    }
  };

  const handleManualSync = async (isAuto = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    if (!isAuto) showToast("Iniciando sincronização...");
    try {
      const res = await syncAfterReconnect();
      if (res.success) {
        showToast(`Sincronização concluída: ${res.newMessages} novas mensagens importadas.`);
        // Force full refresh
        lastSyncTimeRef.current = null;
        const resultData = await getConversations();
        setConversations(resultData.conversations);
        
        // Prevent old messages from appearing as unread
        setLastReadMap(prev => {
          const next = { ...prev };
          const now = new Date().toISOString();
          resultData.conversations.forEach(c => {
            if (!next[c.id]) {
              next[c.id] = now;
            }
          });
          return next;
        });
      } else {
        if (!isAuto) showToast(`Falha na sincronização: ${res.error || res.reason}`);
      }
    } catch (e) {
      console.error(e);
      if (!isAuto) showToast("Erro ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNewChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim()) {
      showToast("Por favor, insira o nome do contato.", "error");
      return;
    }
    if (!newChatPhone.trim()) {
      showToast("Por favor, insira o número de telefone.", "error");
      return;
    }
    
    try {
      setIsSubmittingNewChat(true);
      const result = await startNewConversation(
        newChatName.trim(), 
        newChatPhone.trim(), 
        newChatInitialMessage.trim() || undefined
      );
      if (result.success && result.conversationId) {
        const resultData = await getConversations();
        setConversations(resultData.conversations);
        
        const exists = resultData.conversations.some(c => c.id === result.conversationId);
        if (exists) {
          selectConversation(result.conversationId, resultData.conversations);
          showToast("Conversa iniciada com sucesso!", "success");
        } else {
          showToast("Conversa criada com sucesso! Caso não apareça, verifique os filtros ativos ou sua conexão WhatsApp.", "success");
        }

        setIsNewChatModalOpen(false);
        setNewChatName("");
        setNewChatPhone("");
        setNewChatInitialMessage("");
      }
    } catch (e: any) {
      showToast(e?.message || "Erro ao criar nova conversa.", "error");
    } finally {
      setIsSubmittingNewChat(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeConvo) return;
    try {
      await deleteOutboundMessage(msgId, activeConvo.id);
      setConversations(prev => prev.map(c => 
        c.id === activeConvo.id 
          ? { ...c, messages: c.messages.filter(m => m.id !== msgId) }
          : c
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMessage = async () => {
    if (!activeConvo || !editingMsg) return;
    try {
      await editOutboundMessage(editingMsg.id, editingMsg.text);
      setConversations(prev => prev.map(c => 
        c.id === activeConvo.id 
          ? { ...c, messages: c.messages.map(m => m.id === editingMsg.id ? { ...m, text: editingMsg.text, isEdited: true } : m) }
          : c
      ));
      setEditingMsg(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    if (!activeConvo) return;
    try {
      // Optimistic update
      setConversations(prev => prev.map(c => 
        c.id === activeConvo.id 
          ? {
              ...c,
              messages: c.messages.map(m => {
                if (m.id === msgId) {
                  return {
                    ...m,
                    reactions: emoji ? { [emoji]: Date.now() } : null
                  };
                }
                return m;
              })
            }
          : c
      ));
      await sendMessageReaction(activeConvo.id, msgId, emoji);
    } catch (err) {
      console.error(err);
      showToast("Erro ao reagir à mensagem.", "error");
    }
  };

  const openMyProfile = async () => {
    setIsProfileModalOpen(true);
    setIsProfileLoading(true);
    setProfileError(null);
    setMyProfile(null);
    try {
      const profile = await getWhatsAppProfile();
      if (profile) {
        setMyProfile(profile);
      } else {
        setProfileError("Nenhuma conexão WhatsApp ativa ou configurada.");
      }
    } catch (err) {
      console.error(err);
      setProfileError("Erro ao carregar dados do WhatsApp.");
    } finally {
      setIsProfileLoading(false);
    }
  };

  useEffect(() => {
    if (connectionStatus === "DISCONNECTED") {
      let isSubscribed = true;
      const healConnection = async () => {
        try {
          const { getWhatsAppStatus } = await import("@/actions/whatsapp");
          const liveStatus = await getWhatsAppStatus();
          if (isSubscribed && liveStatus?.status === 'CONNECTED') {
            console.log("[AUTO-HEAL] Chat detected active connection, self-healing status.");
            setConnectionStatus('CONNECTED');
          }
        } catch (e) {
          console.warn("[AUTO-HEAL] Failed to self-heal connection:", e);
        }
      };
      
      const timer = setTimeout(healConnection, 2000);
      return () => {
        isSubscribed = false;
        clearTimeout(timer);
      };
    }
  }, [connectionStatus]);

  useEffect(() => {
    let alive = true;
    let timeoutId: NodeJS.Timeout;

    // Load initial products, origins and stages
    getProducts().then((p) => { if (alive) setProducts(p); }).catch(console.error);
    getLeadOrigins().then((o) => { if (alive) setLeadOrigins(o); }).catch(console.error);
    getPipelineStages().then((s) => { if (alive) setPipelineStages(s); }).catch(console.error);
    getOrganizationUsers().then((u) => { if (alive) setOrganizationUsers(u); }).catch(console.error);

    async function refreshData() {
      if (!alive) return;
      try {
        const syncTime = lastSyncTimeRef.current;
        const queryParams = new URLSearchParams();
        if (syncTime) queryParams.set("since", syncTime);
        if (selectedConnectionId) queryParams.set("connection_id", selectedConnectionId);
        queryParams.set("assignedToMe", String(assignedToMe));
        
        const qs = queryParams.toString();
        const url = `/api/conversations${qs ? `?${qs}` : ""}`;
        const res = await fetch(url);
        if (res.status === 401) {
          setIsLoading(false);
          return;
        }
        if (res.status === 404) {
          console.warn("Conversations API not found (404). Server might be compiling or starting up.");
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = (await res.json()) as {
          conversations: ConversationData[];
          orgId: string;
          syncTime: string;
          connectionStatus: string;
          connections?: { id: string; name: string }[];
        };
        if (!alive) return;

        setConnectionStatus(result.connectionStatus);
        if (result.connections) {
          setAvailableConnections(result.connections);
        }

        // Detect reconnection and trigger automatic sync
        if (
          prevConnectionStatusRef.current === "DISCONNECTED" && 
          result.connectionStatus === "CONNECTED"
        ) {
          showToast("WhatsApp reconectado! Sincronizando mensagens perdidas...");
          handleManualSync(true);
        }
        prevConnectionStatusRef.current = result.connectionStatus;

        // Check for workspace change
        if (typeof window !== "undefined") {
          try {
            const cachedOrgId = localStorage.getItem("sales_arcaffo_org_id");
            if (cachedOrgId && cachedOrgId !== result.orgId) {
              // Workspace changed! Clear old cache and perform full load
              localStorage.removeItem("sales_arcaffo_conversations");
              localStorage.removeItem("sales_arcaffo_last_sync_time");
              lastSyncTimeRef.current = null;
              setConversations(result.conversations);
              localStorage.setItem("sales_arcaffo_org_id", result.orgId);
              localStorage.setItem("sales_arcaffo_last_sync_time", result.syncTime);
              lastSyncTimeRef.current = result.syncTime;
              
              if (result.conversations.length > 0 && !selectedConvo) {
                selectConversation(result.conversations[0].id, result.conversations);
              }
              return;
            }
            localStorage.setItem("sales_arcaffo_org_id", result.orgId);
          } catch (e) {
            console.error("Workspace cache validation error", e);
          }
        }

        setConversations((prev) => {
          let nextList: ConversationData[];
          if (!syncTime || prev.length === 0) {
            nextList = result.conversations;
          } else if (result.conversations.length === 0) {
            return prev;
          } else {
            // Check for new inbound messages before merging
            let hasNewInbound = false;
            const previousById = new Map(prev.map((conversation) => [conversation.id, conversation]));
            result.conversations.forEach(c => {
              const oldConvo = previousById.get(c.id);
              if (oldConvo) {
                const oldMessageIds = new Set(oldConvo.messages.map((message) => message.id));
                const newMsgs = c.messages.filter(m => m.direction === 'inbound' && !oldMessageIds.has(m.id));
                if (newMsgs.length > 0) hasNewInbound = true;
              } else {
                const inboundMsgs = c.messages.filter(m => m.direction === 'inbound');
                if (inboundMsgs.length > 0) hasNewInbound = true;
              }
            });

            if (hasNewInbound) {
              const audio = new Audio("/sounds/notification.mp3");
              audio.play().catch(e => console.error("Audio playback failed:", e));
            }

            // Merge delta changes
            const updatedMap = new Map(result.conversations.map(c => [c.id, c]));
            const previousIds = new Set(prev.map((conversation) => conversation.id));
            const merged = prev.map(c => updatedMap.has(c.id) ? mergeConversationData(c, updatedMap.get(c.id)!) : c);
            const newItems = result.conversations.filter(c => !previousIds.has(c.id));
            nextList = [...newItems, ...merged];
          }

          // Sort by the timestamp of the last message (newest first)
          nextList.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
          });

          return nextList;
        });

        // Update last sync time
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("sales_arcaffo_last_sync_time", result.syncTime);
          } catch (e) {
            console.error("Failed to write last sync time to localStorage", e);
          }
        }
        lastSyncTimeRef.current = result.syncTime;

        if (result.conversations.length > 0 && !selectedConvo) {
          selectConversation(result.conversations[0].id, result.conversations);
        }

        // Check for scheduled message notifications
        void checkScheduledNotifications();
      } catch (error: any) {
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          console.warn("Conversations polling: network offline or server restarting.");
        } else {
          console.error("Failed to load conversations:", error);
        }
      } finally {
        if (alive) {
          setIsLoading(false);
          timeoutId = setTimeout(refreshData, 5000);
        }
      }
    }

    refreshData();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
    };
  }, [selectedConvo, selectedConnectionId, assignedToMe, cacheInvalidationVersion]);

  const handleToggleProduct = async (prodId: string) => {
    if (!activeConvo) return;
    setIsSavingProduct(true);
    const newProducts = draftProducts.includes(prodId)
      ? draftProducts.filter(id => id !== prodId)
      : [...draftProducts, prodId];
    
    // Optimistic update
    setDraftProducts(newProducts);
    try {
      await updateContactProfile(activeConvo.contactId, {
        productIds: newProducts,
      });
      setConversations(current => current.map(c => 
        c.id === activeConvo.id ? { ...c, productIds: newProducts, productId: newProducts.length > 0 ? newProducts[0] : null } : c
      ));
    } catch (err) {
      console.error("Failed to save product:", err);
      setDraftProducts(draftProducts); // rollback
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveOrigin = async (orig: string) => {
    if (!activeConvo) return;
    setIsSavingOrigin(true);
    const previousConversations = [...conversations];
    
    // Optimistic Update
    setConversations(current => current.map(c => 
      c.id === activeConvo.id ? { ...c, origin: orig || null } : c
    ));
    setDraftOrigin(orig);
    
    try {
      await updateContactProfile(activeConvo.contactId, {
        origin: orig || null,
      });
    } catch (err) {
      console.error("Failed to save origin:", err);
      setConversations(previousConversations);
    } finally {
      setIsSavingOrigin(false);
    }
  };

  const handleSaveTemp = async (temp: "HOT" | "WARM" | "COLD") => {
    if (!activeConvo) return;
    setIsSavingTemp(true);
    const previousConversations = [...conversations];
    
    // Optimistic Update
    setConversations(current => current.map(c => 
      c.id === activeConvo.id ? { ...c, status: temp.toLowerCase() as any } : c
    ));
    
    try {
      await updateConversationTemperature(activeConvo.id, temp);
    } catch (err) {
      console.error("Failed to save temperature:", err);
      setConversations(previousConversations);
    } finally {
      setIsSavingTemp(false);
    }
  };

  const filteredConversations = conversations.filter((conversation) => {
    const haystack = [
      conversation.name,
      conversation.company,
      conversation.phone,
      conversation.origin || "",
      conversation.msg,
      conversation.stage,
      conversation.notes || "",
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(searchTerm.toLowerCase())) {
      return false;
    }

    if (filterUnreadOnly) {
      const count = getUnreadCount(conversation);
      if (count === 0) return false;
    }

    if (filterStage !== "all") {
      if (conversation.stageKey !== filterStage) return false;
    }

    if (filterProduct !== "all") {
      if (filterProduct === "none") {
        if (conversation.productId) return false;
      } else {
        if (conversation.productId !== filterProduct) return false;
      }
    }

    return true;
  });

  const handleAnalyze = async () => {
    if (!activeConvo) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const payload = {
        conversationId: activeConvo.id,
        sellerContext: sellerContext.trim() || undefined,
        messages: activeConvo.messages.map((message) => ({
          direction: message.direction,
          timestamp: message.timestamp,
          content: message.text,
        })),
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        const lastKnownTimestamp = activeConvo.latestAnalysis?.createdAt || activeConvo.messages[activeConvo.messages.length - 1]?.timestamp || "";
        const latestAnalysis: ConversationAnalysisData = {
          id: activeConvo.latestAnalysis?.id || `${activeConvo.id}-latest`,
          createdAt: lastKnownTimestamp,
          ...json.data,
        };

        setAnalysisResult(json.data);
        setSellerContext("");
        setConversations((current) => current.map((conversation) => (
          conversation.id === activeConvo.id
            ? { ...conversation, latestAnalysis }
            : conversation
        )));
      } else {
        console.error("API Error:", json.error);
      }
    } catch (error) {
      console.error("Analyze error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getClientMediaType = (file: File) => {
    return normalizeOutboundMediaInput({ fileName: file.name, mimetype: file.type }).mediatype;
  };

  const appendConversationMessage = (newMessage: ConversationMessage) => {
    if (!activeConvo) return;
    setConversations((current) =>
      current.map((c) =>
        c.id === activeConvo.id
          ? { ...c, messages: [...c.messages, newMessage] }
          : c
        )
    );
  };

  const parseXhrJson = (xhr: XMLHttpRequest) => {
    try {
      return JSON.parse(xhr.responseText || "{}");
    } catch {
      return {};
    }
  };

  const sendMediaDirect = async (file: File, mediatype: string) => {
    if (!activeConvo) throw new Error("Conversa não selecionada.");

    const formData = new FormData();
    formData.append("conversationId", activeConvo.id);
    formData.append("file", file, file.name);
    formData.append("mediatype", mediatype);
    formData.append("mimetype", file.type || "application/octet-stream");
    formData.append("fileName", file.name);

    return await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded * 100) / event.total));
        }
      };

      xhr.onload = () => {
        const payload = parseXhrJson(xhr);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload);
          return;
        }

        const error = new Error(payload.error || "Failed to send media") as Error & { status?: number };
        error.status = xhr.status;
        reject(error);
      };

      xhr.onerror = () => reject(new Error("Network Error"));
      xhr.open("POST", "/api/media/send", true);
      xhr.send(formData);
    });
  };

  const uploadToSignedUrl = async (file: File, uploadUrl: string, uploadMimeType?: string) => {
    const formData = new FormData();
    const uploadFile = uploadMimeType && uploadMimeType !== file.type
      ? new File([file], file.name, { type: uploadMimeType })
      : file;
    formData.append("cacheControl", "3600");
    formData.append("", uploadFile, file.name);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.min(85, Math.round((event.loaded * 85) / event.total)));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        reject(new Error(`Falha no upload direto (${xhr.status}).`));
      };

      xhr.onerror = () => reject(new Error("Falha de rede no upload direto."));
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.send(formData);
    });
  };

  const sendMediaViaStorage = async (file: File, mediatype: string) => {
    if (!activeConvo) throw new Error("Conversa não selecionada.");

    const signedResponse = await fetch("/api/media/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimetype: file.type || "application/octet-stream",
        mediatype,
        fileSize: file.size,
      }),
    });
    const signedPayload = await signedResponse.json().catch(() => ({}));

    if (!signedResponse.ok || !signedPayload.success) {
      throw new Error(signedPayload.error || "Não foi possível preparar upload direto.");
    }

    await uploadToSignedUrl(file, signedPayload.uploadUrl, signedPayload.uploadMimeType);
    setUploadProgress(90);

    const sendResponse = await fetch("/api/media/send-from-storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: activeConvo.id,
        storageKey: signedPayload.storageKey,
        mediatype: signedPayload.mediatype || mediatype,
        mimetype: signedPayload.mimetype || file.type || "application/octet-stream",
        fileName: file.name,
        quotedMessageId: quotingMessage?.waMessageId || quotingMessage?.id || "",
      }),
    });
    const payload = await sendResponse.json().catch(() => ({}));

    if (!sendResponse.ok || !payload.success) {
      throw new Error(payload.error || "Falha ao enviar mídia após upload direto.");
    }

    setUploadProgress(100);
    return payload;
  };

  const sendMediaFile = async (file: File, mediatype = getClientMediaType(file)) => {
    if (file.size > DIRECT_MEDIA_UPLOAD_LIMIT) {
      return sendMediaViaStorage(file, mediatype);
    }

    try {
      return await sendMediaDirect(file, mediatype);
    } catch (error) {
      if ((error as { status?: number }).status === 413) {
        return sendMediaViaStorage(file, mediatype);
      }
      throw error;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeConvo) return;

    setIsSending(true);
    setUploadProgress(0);

    try {
      const payload = await sendMediaFile(file);
      setQuotingMessage(null);

      if (!payload.success) {
        throw new Error(payload.error || "Failed to send media");
      }

      appendConversationMessage(payload.message as ConversationMessage);
    } catch (err) {
      console.error("Failed to send media:", err);
      showToast(err instanceof Error ? err.message : "Falha ao enviar arquivo.", "error");
    } finally {
      setIsSending(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendRecordedAudio = async (blob: Blob) => {
    const audioFile = blob instanceof File ? blob : new File([blob], "audio.webm", { type: blob.type || "audio/webm" });
    const payload = await sendMediaFile(audioFile, "audio");
    setQuotingMessage(null);

    if (!payload.success) {
      throw new Error(payload.error || "Failed to send audio");
    }

    appendConversationMessage(payload.message as ConversationMessage);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const extension = blobType.includes("ogg") ? "ogg" : blobType.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunks, { type: blobType });
        try {
          await sendRecordedAudio(new File([blob], `audio.${extension}`, { type: blobType }));
        } catch (err) {
          console.error("Failed to send audio:", err);
          showToast(err instanceof Error ? err.message : "Erro ao enviar áudio.", "error");
        } finally {
          setIsSending(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied:", err);
      showToast("Permissão de microfone negada.", "error");
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      if (cancel) {
        mediaRecorder.onstop = () => {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
          setIsSending(false);
        };
      } else {
        setIsSending(true);
      }
      mediaRecorder.stop();
    }
    
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (!activeConvo || !draftMessage.trim()) {
      return;
    }

    const messageText = draftMessage;
    const tempId = `temp-${Date.now()}`;
    const tempTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const optimisticMessage = {
      id: tempId,
      direction: "outbound" as const,
      type: "TEXT" as const,
      text: messageText,
      time: tempTime,
      timestamp: new Date().toISOString(),
    };

    // OTIMISTA: Atualiza a interface instantaneamente
    setConversations((current) => current.map((conversation) => (
      conversation.id === activeConvo.id
        ? {
            ...conversation,
            msg: messageText,
            time: tempTime,
            messageCount: conversation.messageCount + 1,
            messages: [...conversation.messages, optimisticMessage],
          }
        : conversation
    )));
    
    setDraftMessage("");
    setIsSending(true); // Bloqueia o botão para evitar spam acidental repetido muito rápido

    try {
      // BACKGROUND: Envia o dado para o servidor e API
      const newMessage = await sendConversationMessage(
        activeConvo.id,
        messageText,
        quotingMessage?.waMessageId || quotingMessage?.id
      );
      setQuotingMessage(null);

      // SUBSTITUIÇÃO: Troca a mensagem temporária pela oficial do banco (para ter o ID real)
      setConversations((current) => current.map((conversation) => (
        conversation.id === activeConvo.id
          ? {
              ...conversation,
              messages: conversation.messages.map(m => m.id === tempId ? newMessage : m),
            }
          : conversation
      )));
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!activeConvo) return;
    setIsSavingNotes(true);
    const previousConversations = [...conversations];
    
    // Optimistic Update
    setConversations((current) => 
      current.map((c) => c.id === activeConvo.id ? { ...c, notes: notesDraft } : c)
    );
    
    try {
      const { updateContactNotes } = await import("@/actions/crm");
      await updateContactNotes(activeConvo.contactId, notesDraft);
    } catch (err) {
      console.error(err);
      setConversations(previousConversations);
      showToast("Erro ao salvar anotações.", "error");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveStage = async () => {
    if (!activeConvo || draftStage === activeConvo.stageKey) {
      return;
    }

    const stageConfig = pipelineStages.find(s => s.name === draftStage);
    const newStageLabel = stageConfig?.name || draftStage;

    if (isClosedDealStage(newStageLabel) || isClosedDealStage(draftStage)) {
      setPendingClosedDeal({ leadId: activeConvo.contactId, newStage: draftStage, newStageLabel });
      return;
    }

    setIsSavingStage(true);
    const previousConversations = [...conversations];
    
    // Optimistic Update
    setConversations((current) => current.map((conversation) => (
      conversation.id === activeConvo.id
        ? {
            ...conversation,
            stageKey: draftStage,
            stage: getStageDisplay(draftStage),
          }
        : conversation
    )));
    
    try {
      await updateConversationStage(activeConvo.id, draftStage);
    } catch (error) {
      console.error("Save stage error:", error);
      setConversations(previousConversations);
      showToast("Erro ao salvar etapa.", "error");
    } finally {
      setIsSavingStage(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden font-sans">
      <section 
        className={`relative flex-col shrink-0 border-r border-white/5 bg-[#0a0a0c] transition-all duration-300 ${
          selectedConvo ? "hidden md:flex" : "flex w-full md:w-[380px]"
        } ${isSidebarCollapsed ? "md:w-16" : "md:w-[380px]"}`}
      >
        {/* Sync Overlay */}
        {isSyncing && (
          <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-4" />
            <p className="text-sm font-medium text-zinc-200">Sincronizando mensagens...</p>
            <p className="text-xs text-zinc-400 text-center mt-2 px-4">Baixando histórico recente do WhatsApp.</p>
          </div>
        )}

        {/* Sidebar Header */}
        <div className={`sticky top-0 z-10 flex border-b border-white/5 bg-white/[0.02] p-4 ${isSidebarCollapsed ? "flex-col items-center justify-center gap-3" : "items-center justify-between"}`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-white uppercase tracking-wider">
                Mensagens
              </h1>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleManualSync(false)}
              disabled={isSyncing || connectionStatus !== "CONNECTED"}
              title="Sincronizar mensagens pendentes"
              className={`p-2 rounded transition-colors flex items-center justify-center ${
                connectionStatus !== "CONNECTED" ? "bg-white/5 text-zinc-600 cursor-not-allowed" : "bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300"
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-zinc-400" : ""}`} />
            </button>
          </div>
        </div>
        
        <div className={`border-b border-white/5 p-4 ${isSidebarCollapsed ? "flex flex-col items-center" : ""}`}>
          <div className="flex items-center justify-between mb-3 w-full">
            {!isSidebarCollapsed && <h2 className="label-mono">Inbox</h2>}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title={isSidebarCollapsed ? "Expandir" : "Recolher"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
          
          {!isSidebarCollapsed ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar..."
                    className="input-noir py-2 pl-9 pr-4"
                  />
                </div>
                  <button
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                    className={`p-2 rounded-lg border hover:bg-white/10 transition-colors relative ${
                      isFilterExpanded || (filterUnreadOnly || filterStage !== "all" || filterProduct !== "all" || selectedConnectionId)
                        ? "bg-white/10 border-white/20 text-white hover:bg-white/15"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                    title="Filtros Inteligentes"
                  >
                  <Filter className="w-4 h-4" />
                  {(filterUnreadOnly || filterStage !== "all" || filterProduct !== "all" || selectedConnectionId) && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-sky-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-2 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold transition-all shadow shrink-0"
                  title="Nova Conversa"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button 
                  onClick={openMyProfile}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="Meu Perfil"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {isFilterExpanded && (
                <div className="surface-noir-muted mt-1 space-y-3 p-3 transition-all duration-200">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider text-[9px] text-zinc-500">Filtros Inteligentes</span>
                    {(filterUnreadOnly || filterStage !== "all" || filterProduct !== "all" || selectedConnectionId || !assignedToMe) && (
                      <button 
                        onClick={() => {
                          setFilterUnreadOnly(false);
                          setFilterStage("all");
                          setFilterProduct("all");
                          setSelectedConnectionId("");
                          setAssignedToMe(true);
                          lastSyncTimeRef.current = null;
                        }}
                        className="text-[10px] text-sky-500 hover:text-sky-400 transition-colors"
                      >
                        Limpar Todos
                      </button>
                    )}
                  </div>

                  <div className="mb-2">
                    <label className="block text-[9px] text-zinc-500 mb-0.5">Responsável</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setAssignedToMe(true); lastSyncTimeRef.current = null; }}
                        className={`flex-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${assignedToMe ? 'bg-white text-black border border-white' : 'bg-white/5 text-zinc-500 border border-white/10 hover:text-zinc-300'}`}
                      >
                        Meus leads
                      </button>
                      <button
                        onClick={() => { setAssignedToMe(false); lastSyncTimeRef.current = null; }}
                        className={`flex-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${!assignedToMe ? 'bg-white text-black border border-white' : 'bg-white/5 text-zinc-500 border border-white/10 hover:text-zinc-300'}`}
                      >
                        Todos
                      </button>
                    </div>
                  </div>

                  {availableConnections.length > 1 && (
                    <div className="mb-2">
                      <label className="block text-[9px] text-zinc-500 mb-0.5">Conexão (WhatsApp)</label>
                      <select
                        value={selectedConnectionId}
                        onChange={(e) => {
                          setSelectedConnectionId(e.target.value);
                          lastSyncTimeRef.current = null;
                        }}
                        className="select-noir py-1 text-xs"
                      >
                        <option value="">Todas as conexões</option>
                        {availableConnections.map((conn) => (
                          <option key={conn.id} value={conn.id}>{conn.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">Estágio</label>
                      <select
                        value={filterStage}
                        onChange={(e) => setFilterStage(e.target.value)}
                        className="select-noir py-1 text-xs"
                      >
                        <option value="all">Todos</option>
                        {pipelineStages.map((stage) => (
                          <option key={stage.id} value={stage.name}>{stage.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">Produto</label>
                      <select
                        value={filterProduct}
                        onChange={(e) => setFilterProduct(e.target.value)}
                        className="select-noir py-1 text-xs"
                      >
                        <option value="all">Todos</option>
                        <option value="none">Sem Produto</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <button
                      onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
                      className={`w-full py-1 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                        filterUnreadOnly 
                          ? "bg-sky-500/10 border-sky-500/30 text-sky-400" 
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Não Lidas ({conversations.filter(c => getUnreadCount(c) > 0).length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-2 rounded-full bg-white/5 text-zinc-500 hover:text-white"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {isLoading && conversations.length === 0 ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3 bg-zinc-800 rounded w-1/3" />
                      <div className="h-2 bg-zinc-800 rounded w-1/12" />
                    </div>
                    <div className="h-2 bg-zinc-800 rounded w-1/4" />
                    <div className="h-2 bg-zinc-800 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((convo) => (
              <div
                key={convo.id}
                onClick={() => selectConversation(convo.id, conversations)}
                className={`cursor-pointer transition-all duration-200 group relative ${
                  isSidebarCollapsed ? "p-3 flex justify-center" : "p-3 border-b border-zinc-900"
                } ${
                  selectedConvo === convo.id
                    ? "bg-white/[0.08]"
                    : getUnreadCount(convo) > 0
                      ? "bg-sky-500/[0.04] hover:bg-sky-500/10"
                      : "hover:bg-white/[0.04]"
                }`}
              >
                {isSidebarCollapsed ? (
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center text-[10px] font-bold text-zinc-300 border border-zinc-700/50 overflow-hidden">
                      {convo.avatarUrl ? (
                        <SafeAvatar src={convo.avatarUrl} alt={convo.name} className="w-full h-full object-cover" />
                      ) : (
                        convo.initials
                      )}
                    </div>
                    {getUnreadCount(convo) > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 rounded-full border-2 border-[#0a0a0c] flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white">{getUnreadCount(convo)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-zinc-950 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0 border border-zinc-850 overflow-hidden">
                      {convo.avatarUrl ? (
                        <SafeAvatar src={convo.avatarUrl} alt={convo.name} className="w-full h-full object-cover" />
                      ) : (
                        convo.initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className={`text-[11px] truncate ${getUnreadCount(convo) > 0 ? "text-white font-extrabold" : "text-zinc-300 font-bold"}`}>{convo.name}</h3>
                        <div className="text-[8px] font-mono text-zinc-650">
                          {/* <ConversationTime timestamp={convo.timestamp || ""} fallback={convo.time} /> */}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[convo.status]}`} />
                          <span className="text-[9px] text-zinc-500 font-medium">{convo.stage}</span>
                        </div>
                        {getUnreadCount(convo) > 0 && (
                          <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-sky-500 text-white rounded-full min-w-[16px] h-3.5 flex items-center justify-center shrink-0">
                            {getUnreadCount(convo)}
                          </span>
                        )}
                      </div>
                      <p className={`text-[9px] truncate mt-0.5 ${getUnreadCount(convo) > 0 ? "text-zinc-200 font-semibold" : "text-zinc-550"}`}>
                        {convo.msg}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600 p-8 text-center mt-12">
              <MessageSquare className="w-8 h-8 text-zinc-800 mb-2" />
              <p className="text-xs">Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>
      </section>

      <main className={`flex-1 flex-col bg-background relative min-w-0 ${
        selectedConvo ? "flex w-full" : "hidden md:flex"
      }`}>
        {connectionStatus === "DISCONNECTED" && (
          <div className="w-full bg-red-500/10 border-b border-red-500/20 text-red-500 text-xs px-4 py-2 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>
              <strong>Conexão Perdida!</strong> O WhatsApp desconectou. <a href="/settings" className="underline font-semibold hover:text-red-400">Clique aqui para ler o QRCode novamente.</a>
            </p>
          </div>
        )}
        {activeConvo ? (
          <>
            <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 md:px-6">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => setSelectedConvo(null)}
                  className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0"
                  title="Voltar para Inbox"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div 
                  className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setIsContactProfileModalOpen(true)}
                >
                  <div className="w-8 h-8 rounded bg-zinc-950 flex items-center justify-center border border-zinc-850 shrink-0 overflow-hidden">
                    {activeConvo.avatarUrl ? (
                      <SafeAvatar src={activeConvo.avatarUrl} alt={activeConvo.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-400">{activeConvo.initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold truncate text-white flex items-center gap-2">
                        {activeConvo.name}
                        {isSyncingConvo && (
                          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-zinc-800/50 border border-zinc-700/50" title="Atualizando histórico...">
                            <Loader2 className="w-2.5 h-2.5 text-zinc-400 animate-spin" />
                            <span className="text-[8px] font-medium text-zinc-400 uppercase tracking-wider">Sync</span>
                          </div>
                        )}
                      </h2>
                      {activeConvo.name === activeConvo.phone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditedContactNameValue("");
                            setIsEditingContactName(true);
                            setIsContactProfileModalOpen(true);
                          }}
                          className="flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[9px] font-extrabold uppercase text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-95"
                          title="Salvar Contato no CRM"
                        >
                          <UserPlus className="w-2.5 h-2.5" />
                          Salvar Contato
                        </button>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 shrink-0">
                        {activeConvo.stage}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">{activeConvo.phone} • {activeConvo.company}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 text-zinc-500 shrink-0">
                {!activeConvo.isLead && (
                  <button
                    onClick={async () => {
                      try {
                        const { promoteToLead } = await import('@/actions/crm');
                        const result = await promoteToLead(activeConvo.contactId);
                        setConversations(current => current.map(c => 
                          c.id === activeConvo.id ? { ...c, isLead: true, stage: result.stage } : c
                        ));
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-zinc-200 md:px-3"
                    title="Qualificar Lead"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Qualificar Lead</span>
                  </button>
                )}
                <button
                  onClick={() => openTaskModal()}
                  className="btn-noir-secondary flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs md:px-3"
                  title="Criar tarefa para este lead"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tarefa</span>
                </button>
                <button
                  onClick={() => setIsShareContactModalOpen(true)}
                  className="hidden rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white sm:block"
                  title="Compartilhar este contato"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (confirm("Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita e removerá todas as mensagens e análises.")) {
                      const success = await deleteConversation(activeConvo.id);
                      if (success) {
                        setConversations(current => current.filter(c => c.id !== activeConvo.id));
                        setSelectedConvo(null);
                      } else {
                        showToast("Falha ao excluir conversa. Tente novamente.", "error");
                      }
                    }
                  }}
                  className="hidden sm:block p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded transition-colors"
                  title="Excluir conversa (Spam/Lixo)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white md:hidden"
                  onClick={() => setIsAnalysisCollapsed(!isAnalysisCollapsed)}
                  title="Painel de IA"
                >
                  <BrainCircuit className={`w-4 h-4 ${!isAnalysisCollapsed ? 'text-indigo-400' : ''}`} />
                </button>
                <Phone className="w-4 h-4 cursor-not-allowed opacity-50 hidden sm:block" />
                <MoreVertical className="w-4 h-4 hidden sm:block" />
              </div>
            </header>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-1" id="messages-container">
              {activeConvo.messages.length > 0 ? (
                (() => {
                  let lastDateStr = "";
                  return activeConvo.messages.map((message) => {
                    const dateStr = getMessageDateString(message.timestamp);
                    const showDivider = dateStr !== lastDateStr;
                    lastDateStr = dateStr;

                    return (
                      <React.Fragment key={message.id}>
                        {showDivider && dateStr && (
                          <div className="flex justify-center my-3 sticky top-2 z-10">
                            <span className="px-3 py-1 text-[11px] font-semibold text-zinc-400 bg-zinc-900/85 backdrop-blur-md rounded-full border border-white/5 shadow-md select-none">
                              {dateStr}
                            </span>
                          </div>
                        )}
                        <MessageBubble 
                          msg={message} 
                          avatarUrl={activeConvo.avatarUrl}
                          forwardMode={forwardMode}
                          isSelected={selectedMsgIds.has(message.id)}
                          onToggleSelect={toggleSelection}
                          contactId={activeConvo.contactId}
                          onContextMenu={(e, id) => {
                            e.preventDefault();
                            setContextMenu({ msgId: id, x: e.pageX, y: e.pageY });
                          }}
                          onReactionClick={(id) => setReactionPicker(id)}
                          onStartChat={(phone, name) => handleStartChatWithPhone(phone, name)}
                          onContactUpdate={(updates) => {
                            setConversations(current => current.map(c => 
                              c.id === activeConvo.id ? { ...c, ...updates } : c
                            ));
                          }}
                        />
                      </React.Fragment>
                    );
                  });
                })()
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600">
                  <p className="text-sm">Sem mensagens nesta conversa</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="relative shrink-0 space-y-2 border-t border-white/5 bg-white/[0.02] p-3">
              {isSending && uploadProgress > 0 && uploadProgress <= 100 && (
                <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800 z-50">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-300 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 left-4 z-50">
                  <Suspense fallback={<div className="bg-zinc-900 p-8 rounded-xl border border-white/10 text-zinc-500">Carregando emojis...</div>}>
                    <EmojiPicker 
                      onEmojiClick={handleEmojiClick}
                      theme={"dark" as any}
                      autoFocusSearch={false}
                    />
                  </Suspense>
                </div>
              )}
              {quotingMessage && (
                <div className="flex items-center justify-between bg-zinc-900/50 p-2 text-xs border-t border-white/5 rounded-t-lg mb-1 mx-1">
                  <div className="flex items-center gap-2 overflow-hidden opacity-70">
                    <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    <div className="flex flex-col truncate">
                      <span className="font-semibold text-emerald-400">
                        {quotingMessage.direction === 'inbound' ? 'Cliente' : 'Você'}
                      </span>
                      <span className="truncate text-zinc-300 max-w-xs">{quotingMessage.text || quotingMessage.content || "Mídia"}</span>
                    </div>
                  </div>
                  <button onClick={() => setQuotingMessage(null)} className="text-zinc-500 hover:text-zinc-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              {isRecording ? (
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 animate-pulse">
                  <div className="flex items-center gap-2 text-rose-500">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Gravando: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex-1" />
                  <button 
                    onClick={() => stopRecording(true)}
                    className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Cancelar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => stopRecording(false)}
                    className="flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-black shadow-lg transition-colors hover:bg-zinc-200"
                  >
                    <Check className="w-4 h-4" /> Enviar
                  </button>
                </div>
              ) : editingMsg ? (
                <div className="flex flex-col gap-2 bg-white/5 border border-rose-500/30 rounded-xl p-3">

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Editando Mensagem</span>
                    <button onClick={() => setEditingMsg(null)} className="text-zinc-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <textarea
                      value={editingMsg.text}
                      onChange={(e) => setEditingMsg({ ...editingMsg, text: e.target.value })}
                      className="input-noir min-h-[60px] flex-1 resize-none border-none bg-transparent p-0 text-sm focus:border-transparent"
                      rows={2}
                    />
                    <button 
                      onClick={handleUpdateMessage}
                      className="rounded-lg bg-white p-2 text-black hover:bg-zinc-200"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 md:gap-3">
                  {/* Plus Button for Mobile */}
                  <div className="relative md:hidden">
                    <button
                      onClick={() => setShowMobileActions(!showMobileActions)}
                      className={`rounded-full p-2 transition-colors ${showMobileActions ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"}`}
                    >
                      <Plus className={`w-5 h-5 transition-transform ${showMobileActions ? "rotate-45" : ""}`} />
                    </button>
                    {/* Mobile Submenu Popover */}
                    {showMobileActions && (
                      <div className="surface-noir absolute bottom-full left-0 z-50 mb-2 flex w-max flex-col gap-1 p-1 shadow-xl">
                        <button 
                          onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowMobileActions(false); }}
                           className="flex items-center gap-2 rounded-md p-2 px-3 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <Smile className="w-4 h-4" /> Emoji
                        </button>
                        <button 
                          onClick={() => { setIsQuickRepliesModalOpen(true); setShowMobileActions(false); }}
                           className="flex items-center gap-2 rounded-md p-2 px-3 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-amber-400"
                        >
                          <Zap className="w-4 h-4" /> Respostas Rápidas
                        </button>
                        <button 
                          onClick={() => { fileInputRef.current?.click(); setShowMobileActions(false); }}
                           className="flex items-center gap-2 rounded-md p-2 px-3 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <Paperclip className="w-4 h-4" /> Anexo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Desktop Actions */}
                  <div className="hidden md:flex items-center gap-3">
                    <button 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 transition-colors ${showEmojiPicker ? "text-rose-500" : "text-zinc-500 hover:text-white"}`}
                      title="Emoji"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    
                    <button 
                      onClick={() => setIsQuickRepliesModalOpen(true)}
                      className="p-2 text-zinc-500 hover:text-amber-400 transition-colors"
                      title="Respostas Rápidas"
                    >
                      <Zap className="w-5 h-5" />
                    </button>
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  <div className="flex-1 relative">
                    {/* Quick Replies Dropdown */}
                    {showQuickReplyDropdown && filteredQuickReplies.length > 0 && (
                      <div 
                        ref={quickReplyDropdownRef}
                        className="surface-noir absolute bottom-full left-0 z-50 mb-2 max-h-64 w-72 overflow-y-auto py-1 shadow-xl"
                      >
                        {filteredQuickReplies.map((qr, idx) => (
                          <div
                            key={qr.id}
                            onClick={() => {
                              const lastSlashIndex = draftMessage.lastIndexOf('/');
                              if (lastSlashIndex !== -1) {
                                const newMsg = draftMessage.substring(0, lastSlashIndex) + qr.content + ' ';
                                setDraftMessage(newMsg);
                              }
                              setShowQuickReplyDropdown(false);
                              textareaRef.current?.focus();
                            }}
                            className={`px-3 py-2 cursor-pointer transition-colors ${
                              idx === activeQuickReplyIndex ? 'bg-white/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                /{qr.shortcut}
                              </span>
                              <span className="text-xs font-semibold text-zinc-200">{qr.title}</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 line-clamp-1">{qr.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      placeholder="Escreva sua mensagem..."
                      value={draftMessage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftMessage(val);
                        
                        const lastSlashIndex = val.lastIndexOf('/');
                        if (lastSlashIndex !== -1 && (lastSlashIndex === 0 || val[lastSlashIndex - 1] === ' ' || val[lastSlashIndex - 1] === '\n')) {
                          const query = val.substring(lastSlashIndex + 1).toLowerCase();
                          if (!query.includes(' ') && !query.includes('\n')) {
                            const filtered = quickReplies.filter(qr => 
                              qr.shortcut.includes(query) || qr.title.toLowerCase().includes(query)
                            );
                            if (filtered.length > 0) {
                              setFilteredQuickReplies(filtered);
                              setShowQuickReplyDropdown(true);
                              setActiveQuickReplyIndex(0);
                              return;
                            }
                          }
                        }
                        setShowQuickReplyDropdown(false);
                      }}
                      onKeyDown={(e) => {
                        if (showQuickReplyDropdown && filteredQuickReplies.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveQuickReplyIndex(prev => Math.min(prev + 1, filteredQuickReplies.length - 1));
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveQuickReplyIndex(prev => Math.max(prev - 1, 0));
                            return;
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const qr = filteredQuickReplies[activeQuickReplyIndex];
                            const lastSlashIndex = draftMessage.lastIndexOf('/');
                            if (lastSlashIndex !== -1) {
                              const newMsg = draftMessage.substring(0, lastSlashIndex) + qr.content + ' ';
                              setDraftMessage(newMsg);
                            }
                            setShowQuickReplyDropdown(false);
                            return;
                          }
                          if (e.key === 'Escape') {
                            setShowQuickReplyDropdown(false);
                            return;
                          }
                        }

                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="input-noir max-h-[160px] min-h-[44px] resize-none overflow-y-auto rounded-xl px-4 py-2.5"
                      rows={1}
                    />
                  </div>

                  <button 
                    onClick={startRecording}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <button 
                    onClick={handleSendMessage}
                    disabled={!draftMessage.trim() || isSending}
                    className="rounded-xl bg-white p-2.5 text-black shadow-lg transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}
            </footer>
          </>
        ) : (
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background p-6 text-zinc-600">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.03)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="w-full max-w-lg space-y-8 animate-in fade-in zoom-in-95 duration-500 relative z-10">
              
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-[0_0_40px_-10px_rgba(245,158,11,0.2)]">
                  <MessageSquare className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Dealeto</h3>
                <p className="text-zinc-400 max-w-sm mx-auto">Sua central de atendimento avançada. Escolha uma conversa ao lado para começar.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-2xl font-bold text-white mb-1">{conversations.length}</div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Total</div>
                </div>
                <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-2xl font-bold text-sky-500 mb-1">
                    {conversations.reduce((acc, c) => acc + (getUnreadCount(c) > 0 ? 1 : 0), 0)}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-sky-500/70">Não Lidas</div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {conversations.filter(c => c.isLead).length}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-500/70">Leads</div>
                </div>
              </div>

              <div className="flex gap-3 justify-center pt-4">
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-black shadow-lg transition-all hover:bg-zinc-200 active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  Iniciar Nova Conversa
                </button>
              </div>

            </div>
          </div>
        )}
      </main>

      <section 
        className={`z-20 flex shrink-0 flex-col bg-[#0a0a0c] transition-all duration-300 ${
          isAnalysisCollapsed 
            ? "w-0 overflow-hidden border-white/5 md:w-12 md:border-l "
            : "fixed inset-y-0 right-0 z-40 w-full border-l border-white/10 shadow-2xl md:relative md:w-[420px] md:border-white/5 md:shadow-none pb-[env(safe-area-inset-bottom)] md:pb-0"
        }`}
      >
        <div className={`flex items-center border-b border-white/5 bg-white/[0.02] p-5 ${isAnalysisCollapsed ? "justify-center" : "justify-between"}`}>
          {!isAnalysisCollapsed ? (
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <BrainCircuit className="w-4 h-4 text-zinc-400" />
                <h2 className="font-semibold text-sm tracking-tight text-zinc-200">Dealeto</h2>
              </div>
              <p className="text-[11px] text-zinc-600">Operação tática da conversa</p>
            </div>
          ) : null}
          <button
            onClick={() => setIsAnalysisCollapsed(!isAnalysisCollapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 transition-colors"
          >
            {isAnalysisCollapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
          </button>
        </div>

        {activeConvo && !isAnalysisCollapsed ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex shrink-0 gap-1 border-b border-white/5 bg-white/[0.02] p-2">
              <button 
                onClick={() => setTacticalTab("lead")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tacticalTab === "lead" ? "bg-white text-black" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"}`}
              >
                Lead
              </button>
              <button 
                onClick={() => setTacticalTab("ia")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tacticalTab === "ia" ? "bg-white text-black" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"}`}
              >
                Análise IA
              </button>
              <button 
                onClick={() => setTacticalTab("tasks")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tacticalTab === "tasks" ? "bg-white text-black" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"}`}
              >
                Tarefas
              </button>
              <button 
                onClick={() => setTacticalTab("acoes")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tacticalTab === "acoes" ? "bg-white text-black" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"}`}
              >
                Ações
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {tacticalTab === "lead" && (
                <div className="space-y-5">
                  <div className="surface-noir-muted p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <SectionTitle>Resumo comercial</SectionTitle>
                      </div>
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${
                        activeConvo.status === "hot"
                          ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                          : activeConvo.status === "warm"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                            : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
                      }`}>
                        {activeConvo.status === "hot" ? "Quente" : activeConvo.status === "warm" ? "Morno" : "Frio"}
                      </span>
                    </div>
                    <div className="space-y-2 text-[11px] text-zinc-500">
                      {/* Empresa */}
                        <div className="group relative rounded-lg border border-white/5 bg-white/[0.03] p-2">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-600">Empresa</span>
                        {isEditingCompany ? (
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              className="input-noir py-1 text-xs"
                              value={editedCompanyValue}
                              onChange={e => setEditedCompanyValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  setIsEditingCompany(false);
                                  handleSaveContactField('company', editedCompanyValue);
                                }
                                if (e.key === "Escape") setIsEditingCompany(false);
                              }}
                              onBlur={() => {
                                setIsEditingCompany(false);
                                handleSaveContactField('company', editedCompanyValue);
                              }}
                            />
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center justify-between">
                            <span className="block truncate text-zinc-300">{activeConvo.company || "Não informada"}</span>
                            <button
                              onClick={() => {
                                setEditedCompanyValue(activeConvo.company || "");
                                setIsEditingCompany(true);
                              }}
                              className="text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Email */}
                      <div className="group relative rounded-lg border border-white/5 bg-white/[0.03] p-2">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-600">E-mail</span>
                        {isEditingEmail ? (
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              autoFocus
                              type="email"
                              className="input-noir py-1 text-xs"
                              value={editedEmailValue}
                              onChange={e => setEditedEmailValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  setIsEditingEmail(false);
                                  handleSaveContactField('email', editedEmailValue);
                                }
                                if (e.key === "Escape") setIsEditingEmail(false);
                              }}
                              onBlur={() => {
                                setIsEditingEmail(false);
                                handleSaveContactField('email', editedEmailValue);
                              }}
                            />
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center justify-between">
                            <span className="block truncate text-zinc-300">{activeConvo.email || "Não informado"}</span>
                            <button
                              onClick={() => {
                                setEditedEmailValue(activeConvo.email || "");
                                setIsEditingEmail(true);
                              }}
                              className="text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Responsável e Closer */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="group relative rounded-lg border border-white/5 bg-white/[0.03] p-2">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-600">Responsável</span>
                          <select
                            value={activeConvo.assignedUserId || ""}
                            onChange={e => handleSaveContactField('assignedUserId', e.target.value)}
                            className="select-noir w-full py-1 text-xs border-none bg-transparent px-0 outline-none focus:ring-0"
                          >
                            <option value="">Nenhum</option>
                            {organizationUsers.map(user => (
                              <option key={user.id} value={user.id}>{user.name || user.email}</option>
                            ))}
                          </select>
                        </div>

                        <div className="group relative rounded-lg border border-white/5 bg-white/[0.03] p-2">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-600">Closer</span>
                          <select
                            value={activeConvo.closerId || ""}
                            onChange={e => handleSaveContactField('closerId', e.target.value)}
                            className="select-noir w-full py-1 text-xs border-none bg-transparent px-0 outline-none focus:ring-0"
                          >
                            <option value="">Nenhum</option>
                            {organizationUsers.map(user => (
                              <option key={user.id} value={user.id}>{user.name || user.email}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Temperatura Híbrida (IA + Manual) */}
                  <div className="space-y-2">
                    <SectionTitle>Temperatura do Lead</SectionTitle>
                    <div className="flex gap-2">
                      {(["HOT", "WARM", "COLD"] as const).map(temp => (
                        <button
                          key={temp}
                          disabled={isSavingTemp}
                          onClick={() => handleSaveTemp(temp)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            activeConvo.status.toUpperCase() === temp
                              ? temp === "HOT" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : temp === "WARM" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                              : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10"
                          }`}
                        >
                          {temp === "HOT" ? "🔥 Quente" : temp === "WARM" ? "☀️ Morno" : "❄️ Frio"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estágio Comercial */}
                  <div className="space-y-2">
                    <SectionTitle>Estágio Comercial</SectionTitle>
                    <div className="flex gap-2">
                      <select
                        value={draftStage}
                        onChange={(event) => setDraftStage(event.target.value)}
                        className="select-noir flex-1"
                      >
                        {pipelineStages.map((stage) => (
                          <option key={stage.id} value={stage.name}>
                            {stage.name}
                          </option>
                        ))}
                        {draftStage && !pipelineStages.some(s => s.name === draftStage) && (
                          <option value={draftStage}>
                            {getStageDisplay(draftStage)}
                          </option>
                        )}
                      </select>
                      <button
                        onClick={() => void handleSaveStage()}
                        disabled={isSavingStage || draftStage === activeConvo.stageKey}
                        className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Save className="w-4 h-4" />
                        {isSavingStage ? "Salvando" : "Salvar"}
                      </button>
                    </div>
                  </div>

                  {/* Orçamento / Proposta */}
                  <Suspense fallback={<div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-zinc-500">Carregando orçamento...</div>}>
                    <QuoteEditor 
                      contactId={activeConvo.contactId}
                      contactProducts={activeConvo.contactProducts || []}
                      catalogProducts={products}
                      onUpdate={async () => {
                        try {
                          const resultData = await getConversations(selectedConvo ?? undefined);
                          setConversations(resultData.conversations);
                        } catch(e) { console.error(e) }
                      }}
                    />
                  </Suspense>

                  {/* Origem do Lead */}
                  <div className="space-y-2">
                    <SectionTitle>Origem do Lead</SectionTitle>
                    <select
                      value={draftOrigin}
                      disabled={isSavingOrigin}
                      onChange={(e) => handleSaveOrigin(e.target.value)}
                      className="select-noir"
                    >
                      <option value="">Não informado</option>
                      {leadOrigins.map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <SectionTitle>Anotações do Lead</SectionTitle>
                      {notesDraft !== (activeConvo.notes || "") && (
                        <button 
                          onClick={handleSaveNotes}
                          disabled={isSavingNotes}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors font-semibold"
                        >
                          <Save className="w-3 h-3" />
                          {isSavingNotes ? "Salvando..." : "Salvar"}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Registre insights, dores ou observações sobre o lead..."
                      className="input-noir min-h-28 resize-none rounded-lg bg-white/[0.02] p-3 text-zinc-400 placeholder:text-zinc-700"
                    />
                  </div>
                </div>
              )}

              {tacticalTab === "ia" && (
                <div className="space-y-5 h-full">
                  {!analysisResult && !isAnalyzing ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60 py-8">
                      <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                        <Target className="w-7 h-7 text-zinc-700" />
                      </div>
                      <p className="text-xs text-zinc-600 max-w-[220px] leading-relaxed">
                        Use a última análise salva ou gere uma nova leitura estratégica da negociação.
                      </p>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 py-8">
                      <div className="relative">
                        <div className="w-14 h-14 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin" />
                        <BrainCircuit className="w-5 h-5 text-zinc-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div className="text-center space-y-1.5">
                        <p className="text-sm font-medium animate-pulse text-zinc-300">Analisando conversa...</p>
                        <p className="text-[11px] text-zinc-600">Cruzando contexto, áudio e histórico comercial.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeConvo.latestAnalysis && (
                        <div className="text-[11px] text-zinc-500">
                          Última análise salva em {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(activeConvo.latestAnalysis.createdAt))}
                        </div>
                      )}
                      {analysisResult ? (
                        <AnalysisPanel
                          result={analysisResult}
                          analysisId={activeConvo.latestAnalysis?.id}
                          onCopy={handleCopy}
                          copiedId={copiedId}
                          onCreateTask={(title, description, priority, dueAt) => openTaskModal({ title, description, priority, dueAt, source: "AI", analysisId: activeConvo.latestAnalysis?.id || null })}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              )}

              {tacticalTab === "tasks" && (
                <div className="space-y-4">
                  <button
                    onClick={() => openTaskModal()}
                    className="btn-noir flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Nova tarefa para este lead
                  </button>

                  <div className="space-y-2">
                    <SectionTitle>Tarefas abertas</SectionTitle>
                    {isLoadingLeadTasks ? (
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-xs text-zinc-500">Carregando tarefas...</div>
                    ) : leadTasks.filter((task) => task.status !== "DONE").length > 0 ? (
                      leadTasks.filter((task) => task.status !== "DONE").map((task) => (
                        <TaskRow key={task.id} task={task} onToggle={() => void handleToggleLeadTask(task)} />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
                        <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-zinc-700" />
                        <p className="text-xs font-medium text-zinc-500">Nenhuma tarefa aberta para este lead.</p>
                        <p className="mt-1 text-[11px] text-zinc-700">Crie uma próxima ação para não deixar a negociação parada.</p>
                      </div>
                    )}
                  </div>

                  {leadTasks.filter((task) => task.status === "DONE").length > 0 && (
                    <div className="space-y-2 border-t border-white/5 pt-4">
                      <SectionTitle>Concluídas recentemente</SectionTitle>
                      {leadTasks.filter((task) => task.status === "DONE").slice(0, 3).map((task) => (
                        <TaskRow key={task.id} task={task} onToggle={() => void handleToggleLeadTask(task)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tacticalTab === "acoes" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <SectionTitle>Próxima ação</SectionTitle>
                    <button
                      onClick={() => openTaskModal()}
                      className="btn-noir-secondary flex w-full cursor-pointer items-center justify-center gap-2 py-2 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Criar tarefa vinculada ao lead
                    </button>
                  </div>

                  <div className="space-y-2">
                    <SectionTitle>Reunião</SectionTitle>
                    <button
                      onClick={() => setMeetingModalOpen(true)}
                      className="btn-noir-secondary flex w-full cursor-pointer items-center justify-center gap-2 py-2 text-xs"
                    >
                      <Calendar className="w-4 h-4" />
                      Agendar Reunião
                    </button>
                  </div>

                  <div className="space-y-2">
                    <SectionTitle>Eventos</SectionTitle>
                    <button
                      onClick={() => setInviteMasterclassLeadId(activeConvo.contactId)}
                      className="btn-noir-secondary flex w-full cursor-pointer items-center justify-center gap-2 py-2 text-xs"
                    >
                      <Sparkles className="w-4 h-4" />
                      Convidar para MASTERCLASS
                    </button>
                  </div>

                  <div className="space-y-2">
                    <SectionTitle>Agendamento de Mensagens</SectionTitle>
                    <div className="surface-noir-muted p-3 space-y-4">
                      <p className="text-[10px] text-zinc-500">
                        Escolha a data e a hora globais. Você pode agendar várias mensagens para enviar em sequência a partir desse horário.
                      </p>

                      <div className="surface-noir flex flex-col gap-2 p-3">
                        <label className="text-[9px] uppercase font-bold tracking-wider text-sky-500 block">
                          Data e Hora do Disparo Inicial
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={scheduleGlobalDate}
                            onChange={(e) => setScheduleGlobalDate(e.target.value)}
                            className="input-noir flex-1 py-1.5 text-xs"
                          />
                          <input
                            type="time"
                            value={scheduleGlobalTime}
                            onChange={(e) => setScheduleGlobalTime(e.target.value)}
                            className="input-noir w-[100px] py-1.5 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        {scheduledMessages.map((item, index) => (
                          <div key={item.id} className="space-y-2 pb-4 border-b border-white/5 relative">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">
                                Mensagem {index + 1}
                              </label>
                              {scheduledMessages.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setScheduledMessages(prev => prev.filter(i => i.id !== item.id))}
                                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            
                            <textarea
                              value={item.content}
                              onChange={(e) => {
                                const newItems = [...scheduledMessages];
                                newItems[index].content = e.target.value;
                                setScheduledMessages(newItems);
                              }}
                              placeholder="Escreva a mensagem..."
                              className="input-noir min-h-[60px] resize-none p-2 text-xs placeholder:text-zinc-700"
                            />
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => setScheduledMessages([...scheduledMessages, { id: Date.now().toString(), content: "" }])}
                          className="w-full py-1.5 bg-white/5 border border-white/10 border-dashed rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Adicionar Mensagem
                        </button>
                      </div>

                      {pendingSchedules.length > 0 && (
                        <div className="pt-2">
                          <label className="text-[9px] uppercase font-bold tracking-wider text-emerald-500 block mb-2">Mensagens Pendentes ({pendingSchedules.length})</label>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {pendingSchedules.map((schedule) => (
                              <div key={schedule.id} className="flex flex-col gap-1.5 rounded border border-white/5 bg-white/[0.03] p-2">
                                <p className="text-[10px] text-zinc-300 line-clamp-2">{schedule.content}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] text-zinc-500">
                                    {new Date(schedule.scheduledFor).toLocaleString('pt-BR', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditSchedule(schedule)}
                                      className="text-[9px] text-blue-400 hover:text-blue-300"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => handleCancelSchedule(schedule.id)}
                                      className="text-[9px] text-red-400 hover:text-red-300"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleSaveSchedule()}
                        disabled={isSavingSchedule || !scheduleGlobalDate || !scheduleGlobalTime || scheduledMessages.every(i => !i.content)}
                        className="btn-noir mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingSchedule ? "Salvando..." : "Salvar Agendamento"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {tacticalTab === "ia" && !isAnalysisCollapsed && (
              <div className="p-4 border-t border-white/[0.06] space-y-3 shrink-0">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">Direcionamento para a IA</label>
                  <textarea
                    value={sellerContext}
                    onChange={(e) => setSellerContext(e.target.value)}
                    placeholder="Qual a situação atual do lead para eu ajudar? (Opcional)"
                    className="input-noir min-h-16 resize-none rounded-lg p-2.5 text-xs text-zinc-300 placeholder:text-zinc-700"
                  />
                </div>
                <button
                  onClick={() => void handleAnalyze()}
                  disabled={!selectedConvo || isAnalyzing}
                  className="btn-noir flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Zap className="w-4 h-4" />
                  {isAnalyzing ? "Processando..." : "Analisar Negociação"}
                </button>
              </div>
            )}
          </div>
        ) : isAnalysisCollapsed && activeConvo ? (
          <div className="flex-1 flex flex-col items-center py-8">
            <button 
              onClick={() => setIsAnalysisCollapsed(false)}
              className="group relative p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <BrainCircuit className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300" />
            </button>
          </div>
        ) : null}
      </section>

      {/* Floating UI: Context Menu */}
      {contextMenu && (
        <div 
          className="surface-noir fixed z-[100] min-w-[160px] overflow-hidden py-1 shadow-2xl animate-in fade-in zoom-in duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeConvo?.messages.find(m => m.id === contextMenu.msgId)?.direction === 'outbound' && (
            <button 
              onClick={() => {
                const msg = activeConvo?.messages.find(m => m.id === contextMenu.msgId);
                if (msg) setEditingMsg({ id: msg.id, text: msg.text });
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <Pencil className="w-4 h-4" /> Editar
            </button>
          )}
          <button
            onClick={() => {
              const msg = activeConvo?.messages.find(m => m.id === contextMenu.msgId);
              if (msg) setQuotingMessage(msg);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            Responder
          </button>
          <button 
            onClick={() => {
              setForwardMode(true);
              setSelectedMsgIds(new Set([contextMenu.msgId]));
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            Encaminhar
          </button>
          <button 
            onClick={() => {
              handleDeleteMessage(contextMenu.msgId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Apagar
          </button>
        </div>
      )}

      {/* Floating Top Bar for Forward Mode */}
      {forwardMode && (
        <div className="fixed top-0 left-0 right-0 z-[150] border-b border-white/10 bg-[#09090b] p-4 flex items-center justify-between shadow-xl animate-in slide-in-from-top-full duration-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setForwardMode(false); setSelectedMsgIds(new Set()); }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <span className="font-medium">{selectedMsgIds.size} selecionada(s)</span>
          </div>
          <button 
            onClick={() => setIsForwardModalOpen(true)}
            disabled={selectedMsgIds.size === 0}
            className="btn-noir flex items-center gap-2 rounded-lg px-4 py-2 disabled:opacity-50"
          >
            Encaminhar <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      )}

      {/* Forward Destination Modal */}
      {isForwardModalOpen && (
        <Modal
          onClose={() => setIsForwardModalOpen(false)}
          title="Encaminhar para..."
          icon={<ArrowRight className="h-5 w-5 text-zinc-400" />}
          maxWidth="max-w-md"
          overlayClassName="z-[200]"
          contentClassName="flex flex-1 flex-col p-0"
        >
            <div className="border-b border-white/5 p-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  value={forwardQuery}
                  onChange={(e) => setForwardQuery(e.target.value)}
                  placeholder="Buscar conversa..."
                  className="input-noir py-2 pl-9 pr-4"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations
                .filter(c => c.name.toLowerCase().includes(forwardQuery.toLowerCase()) || c.phone.includes(forwardQuery))
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleForwardExecute(c.id)}
                    disabled={isForwarding}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {c.avatarUrl ? (
                        <SafeAvatar src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{c.phone}</p>
                    </div>
                  </button>
              ))}
              {conversations.filter(c => c.name.toLowerCase().includes(forwardQuery.toLowerCase()) || c.phone.includes(forwardQuery)).length === 0 && (
                <div className="p-4 text-center text-sm text-zinc-500">Nenhuma conversa encontrada.</div>
              )}
            </div>
        </Modal>
      )}

      {/* Floating UI: Reaction Picker */}
      {reactionPicker && (
        <div 
          className="surface-noir fixed z-[100] flex gap-1 rounded-full px-2 py-1.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ 
            top: (document.getElementById(reactionPicker)?.getBoundingClientRect().top || 0) - 50,
            left: document.getElementById(reactionPicker)?.getBoundingClientRect().left
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => {
            const msg = activeConvo?.messages.find(m => m.id === reactionPicker);
            const isSelected = msg?.reactions && typeof msg.reactions === 'object' && emoji in (msg.reactions as object);
            return (
              <button 
                key={emoji}
                onClick={() => {
                  handleReaction(reactionPicker, isSelected ? "" : emoji);
                  setReactionPicker(null);
                }}
                className={`p-1.5 hover:bg-white/10 rounded-full transition-all hover:scale-125 text-lg ${isSelected ? 'bg-white/20' : ''}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <Modal
          onClose={() => setIsProfileModalOpen(false)}
          title="Meu Perfil WhatsApp"
          icon={<User className="h-5 w-5 text-zinc-400" />}
          maxWidth="max-w-md"
          overlayClassName="z-[200]"
          contentClassName="space-y-6 p-8"
          footer={(
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="btn-noir rounded-xl px-6 py-2.5 text-sm"
            >
              Concluído
            </button>
          )}
        >
          {isProfileLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">Carregando dados do WhatsApp...</p>
            </div>
          ) : profileError ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 mb-2">
                <X className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-sm text-zinc-300">Não foi possível carregar</h4>
              <p className="text-xs text-zinc-500 max-w-[280px]">{profileError}</p>
              <button
                onClick={openMyProfile}
                className="btn-noir-secondary mt-2 rounded-xl px-4 py-2 text-xs"
              >
                Tentar Novamente
              </button>
            </div>
          ) : myProfile ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-3xl font-bold overflow-hidden shadow-xl">
                    {myProfile.picture ? (
                      <SafeAvatar src={myProfile.picture} alt="Profile" className="w-full h-full object-cover" />
                    ) : myProfile.name?.substring(0, 1)}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Paperclip className="w-6 h-6 text-white" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const base64 = (reader.result as string).split(',')[1];
                            await updateWhatsAppProfile({ pictureBase64: base64 });
                            openMyProfile(); // refresh
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-500 mb-1">Status da Instância</p>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Online
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="label-field px-1">Nome no WhatsApp</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={myProfile.name}
                      onBlur={(e) => updateWhatsAppProfile({ name: e.target.value })}
                      className="input-noir flex-1 rounded-xl px-4 py-2.5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-field px-1">Recado (Status)</label>
                  <textarea
                    defaultValue={myProfile.status}
                    onBlur={(e) => updateWhatsAppProfile({ status: e.target.value })}
                    className="input-noir resize-none rounded-xl px-4 py-2.5"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500 mb-2">
                <X className="w-6 h-6" />
              </div>
              <p className="text-xs text-zinc-500">WhatsApp desconectado ou indisponível.</p>
            </div>
          )}
        </Modal>
      )}

      {/* Contact Profile Modal (Popup) */}
      {isContactProfileModalOpen && activeConvo && (
        <Modal
          onClose={() => setIsContactProfileModalOpen(false)}
          title="Perfil do Contato"
          icon={<User className="h-5 w-5 text-zinc-400" />}
          maxWidth="max-w-md"
          overlayClassName="z-[200]"
          contentClassName="p-8"
          footer={(
            <>
              <button
                onClick={() => setIsContactProfileModalOpen(false)}
                className="btn-noir-secondary rounded-xl px-6 py-2.5 text-sm"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setIsContactProfileModalOpen(false);
                  setIsAnalysisCollapsed(false);
                }}
                className="btn-noir rounded-xl px-6 py-2.5 text-sm"
              >
                Ver Análise IA
              </button>
            </>
          )}
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-white/5 mb-4 flex items-center justify-center text-3xl font-bold overflow-hidden shadow-xl">
              {activeConvo.avatarUrl ? (
                <SafeAvatar src={activeConvo.avatarUrl} alt={activeConvo.name} className="w-full h-full object-cover" />
              ) : activeConvo.name.substring(0, 1)}
            </div>
            {isEditingContactName ? (
              <div className="flex items-center justify-center gap-2 mt-1 px-4 mb-2">
                <input
                  type="text"
                  value={editedContactNameValue}
                  onChange={(e) => setEditedContactNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveContactName();
                    if (e.key === 'Escape') setIsEditingContactName(false);
                  }}
                  className="input-noir max-w-[200px] rounded-xl px-4 py-2 text-center font-semibold text-white"
                  autoFocus
                />
                <button
                  onClick={handleSaveContactName}
                  className="btn-noir rounded-xl p-2"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingContactName(false)}
                  className="btn-noir-secondary rounded-xl p-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h2
                onClick={() => {
                  setEditedContactNameValue(activeConvo.name);
                  setIsEditingContactName(true);
                }}
                className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-2 cursor-pointer group hover:text-zinc-300 transition-all"
                title="Clique para editar"
              >
                <span>{activeConvo.name}</span>
                <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-zinc-300 transition-all" />
              </h2>
            )}
            <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
              <Phone className="w-3.5 h-3.5" />
              <span>{activeConvo.phone}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <MetaCard label="Empresa" value={activeConvo.company} />
            <MetaCard label="Origem" value={activeConvo.origin || "Não informado"} />
            <MetaCard label="Estágio" value={activeConvo.stage} />
            <MetaCard label="Temperatura" value={activeConvo.status.toUpperCase()} />
          </div>

          <div className="space-y-4">
            <div className="surface-noir-muted p-4">
              <p className="label-field mb-2">Anotações do CRM</p>
              <p className="text-sm text-zinc-400 italic leading-relaxed">
                {activeConvo.notes || "Nenhuma anotação registrada para este contato."}
              </p>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Fechamento Modal */}
      {pendingClosedDeal && (
        <Suspense fallback={null}>
          <ClosedDealModal
            leadId={pendingClosedDeal.leadId}
            leadName={activeConvo?.name || "Lead"}
            targetStage={pendingClosedDeal.newStageLabel || pendingClosedDeal.newStage}
            onClose={() => setPendingClosedDeal(null)}
            onSuccess={() => {
              showToast("Venda despachada e e-mail enviado com sucesso!", "success");
              const stageToSave = pendingClosedDeal.newStage;
              setPendingClosedDeal(null);
              
              // Proceed with optimistic update and saving
              if (activeConvo) {
                setIsSavingStage(true);
                const previousConversations = [...conversations];
                setConversations((current) => current.map((conversation) => (
                  conversation.id === activeConvo.id
                    ? {
                        ...conversation,
                        stageKey: stageToSave,
                        stage: pendingClosedDeal.newStageLabel,
                      }
                    : conversation
                )));
                
                updateConversationStage(activeConvo.id, stageToSave)
                  .catch(err => {
                    console.error(err);
                    setConversations(previousConversations);
                    showToast("Erro ao salvar etapa.", "error");
                  })
                  .finally(() => setIsSavingStage(false));
              }
            }}
          />
        </Suspense>
      )}

      {/* Masterclass Modal */}
      {inviteMasterclassLeadId && (
        <Suspense fallback={null}>
          <InviteMasterclassModal
            leadId={inviteMasterclassLeadId}
            leadName={activeConvo?.name || "Lead"}
            onClose={() => setInviteMasterclassLeadId(null)}
            onSuccess={() => {
              showToast("Convite de Masterclass enviado com sucesso!", "success");
              setInviteMasterclassLeadId(null);
            }}
          />
        </Suspense>
      )}

      {/* === MODAL: COMPARTILHAR CONTATO === */}
      {isShareContactModalOpen && activeConvo && (
        <Modal
          onClose={() => {
            setIsShareContactModalOpen(false);
            setShareContactSearchQuery("");
          }}
          title={`Enviar ${activeConvo.name} para...`}
          icon={<Share2 className="h-5 w-5 text-zinc-400" />}
          maxWidth="max-w-md"
          overlayClassName="z-[200]"
          contentClassName="flex flex-1 flex-col p-0"
        >
            <div className="border-b border-white/5 p-4">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar contato de destino..."
                  value={shareContactSearchQuery}
                  onChange={(e) => setShareContactSearchQuery(e.target.value)}
                  className="input-noir rounded-xl py-2.5 pl-9 pr-4"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {conversations
                .filter(c => c.id !== activeConvo.id && (c.name.toLowerCase().includes(shareContactSearchQuery.toLowerCase()) || c.phone.includes(shareContactSearchQuery)))
                .map(c => (
                  <button
                    key={c.id}
                    onClick={async () => {
                      if (isSharingContact) return;
                      setIsSharingContact(true);
                      try {
                        const { shareContactMessage } = await import('@/actions/crm');
                        await shareContactMessage(activeConvo.contactId, c.id);
                        showToast(`Contato enviado para ${c.name} com sucesso!`);
                        setIsShareContactModalOpen(false);
                        setShareContactSearchQuery("");
                      } catch (err: any) {
                        showToast(err.message || "Erro ao compartilhar contato", "error");
                      } finally {
                        setIsSharingContact(false);
                      }
                    }}
                    disabled={isSharingContact}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.04] rounded-xl transition-colors text-left group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                      {c.avatarUrl ? (
                        <SafeAvatar src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-zinc-500">{c.initials}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-200 truncate group-hover:text-sky-400 transition-colors">{c.name}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{c.phone}</p>
                    </div>
                    <Send className="w-4 h-4 text-zinc-600 group-hover:text-sky-400 transition-colors shrink-0" />
                  </button>
                ))}
                
              {conversations.filter(c => c.id !== activeConvo.id && (c.name.toLowerCase().includes(shareContactSearchQuery.toLowerCase()) || c.phone.includes(shareContactSearchQuery))).length === 0 && (
                <div className="text-center py-8 text-sm text-zinc-500">
                  Nenhum contato encontrado.
                </div>
              )}
            </div>
        </Modal>
      )}

      {/* === MODAL: QUICK REPLIES === */}
      {isQuickRepliesModalOpen && (
        <Modal
          onClose={() => setIsQuickRepliesModalOpen(false)}
          title="Respostas Rápidas"
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          maxWidth="max-w-2xl"
          overlayClassName="z-[200]"
          contentClassName="p-6"
        >
              <div className="mb-6">
                <p className="text-sm text-zinc-400 mb-4">
                  Crie atalhos para mensagens que você envia com frequência. Para usar, digite <code className="bg-zinc-800 px-1 rounded text-amber-400">/</code> seguido do atalho na caixa de mensagem.
                </p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.75fr_1fr_2fr_auto]">
                  <input
                    type="text"
                    placeholder="Atalho (ex: ola)"
                    id="qr-shortcut"
                    className="input-noir rounded-xl px-4 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Título (ex: Saudação inicial)"
                    id="qr-title"
                    className="input-noir rounded-xl px-4 py-2"
                  />
                  <textarea
                    placeholder="Mensagem..."
                    id="qr-content"
                    className="input-noir h-[42px] resize-none rounded-xl px-4 py-2"
                  />
                  <button
                    onClick={async () => {
                      const shortcut = (document.getElementById('qr-shortcut') as HTMLInputElement).value;
                      const title = (document.getElementById('qr-title') as HTMLInputElement).value;
                      const content = (document.getElementById('qr-content') as HTMLTextAreaElement).value;
                      if (!shortcut || !title || !content) {
                        showToast("Preencha todos os campos", "error");
                        return;
                      }
                      const res = await createQuickReply(shortcut, title, content);
                      if (res.success) {
                        showToast("Resposta rápida criada!");
                        setQuickReplies(prev => [...prev, res.reply as QuickReplyData].sort((a,b) => a.shortcut.localeCompare(b.shortcut)));
                        (document.getElementById('qr-shortcut') as HTMLInputElement).value = "";
                        (document.getElementById('qr-title') as HTMLInputElement).value = "";
                        (document.getElementById('qr-content') as HTMLTextAreaElement).value = "";
                      } else {
                        showToast(res.error || "Erro", "error");
                      }
                    }}
                    className="btn-noir rounded-xl px-4 text-xs"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {quickReplies.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    Nenhuma resposta rápida cadastrada ainda.
                  </div>
                ) : (
                  quickReplies.map((qr) => (
                    <div key={qr.id} className="surface-noir-muted p-4 group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">/{qr.shortcut}</span>
                          <h4 className="font-semibold text-zinc-200 text-sm">{qr.title}</h4>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm("Excluir esta resposta rápida?")) {
                              const res = await deleteQuickReply(qr.id);
                              if (res.success) {
                                setQuickReplies(prev => prev.filter(r => r.id !== qr.id));
                                showToast("Excluída com sucesso.");
                              } else {
                                showToast(res.error || "Erro", "error");
                              }
                            }
                          }}
                          className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-zinc-400 whitespace-pre-wrap">{qr.content}</p>
                    </div>
                  ))
                )}
              </div>
        </Modal>
      )}

      {/* === MODAL: AGENDAR REUNIÃO === */}
      {meetingModalOpen && (
        <Suspense fallback={null}>
          <MeetingModal
            isOpen={meetingModalOpen}
            onClose={() => setMeetingModalOpen(false)}
            onSuccess={(email) => {
              if (activeConvo) {
                // update local conversation stage to AGENDADO if we want, or just re-fetch
                const newConversations = conversations.map(c => 
                  c.id === activeConvo.id ? { ...c, stage: "Agendado", email: email || c.email } : c
                );
                setConversations(newConversations);
              }
            }}
            contactId={activeConvo?.contactId || ""}
            contactName={activeConvo?.name || ""}
            defaultEmail={activeConvo?.email || ""}
            defaultAddress={activeConvo?.address || ""}
          />
        </Suspense>
      )}

      {taskModal && (
        <Suspense fallback={null}>
          <TaskModal
            isOpen={Boolean(taskModal)}
            onClose={() => setTaskModal(null)}
            onCreated={(task) => {
              setLeadTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
              setTacticalTab("tasks");
            }}
            contactId={taskModal?.contactId || null}
            contactName={taskModal?.contactName || ""}
            defaultTitle={taskModal?.defaultTitle || ""}
            defaultDescription={taskModal?.defaultDescription || ""}
            defaultType={taskModal?.defaultType || "FOLLOW_UP"}
            defaultPriority={taskModal?.defaultPriority || "MEDIUM"}
            defaultDueAt={taskModal?.defaultDueAt || ""}
            defaultSource={taskModal?.defaultSource || "MANUAL"}
            defaultConversationId={taskModal?.defaultConversationId || null}
            defaultAnalysisId={taskModal?.defaultAnalysisId || null}
          />
        </Suspense>
      )}

      {/* === MODAL: NOVA CONVERSA === */}
      {isNewChatModalOpen && (
        <Modal
          onClose={() => {
            setIsNewChatModalOpen(false);
            setNewChatName("");
            setNewChatPhone("");
            setNewChatInitialMessage("");
          }}
          title="Nova Conversa"
          icon={<UserPlus className="h-5 w-5 text-zinc-400" />}
          maxWidth="max-w-md"
          overlayClassName="z-[200]"
          contentClassName="p-0"
        >
            <form onSubmit={handleCreateNewChatSubmit} className="p-6 space-y-4">
              <div>
                <label className="label-field mb-1.5 block">Nome do Contato</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Arthur Fava"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="input-noir rounded-xl py-2.5"
                />
              </div>

              <div>
                <label className="label-field mb-1.5 block">Número do WhatsApp</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: 5511999999999"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="input-noir rounded-xl py-2.5"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Inclua o DDI (55) + DDD + número. Exemplo: 5511999999999</p>
              </div>

              <div>
                <label className="label-field mb-1.5 block">Mensagem Inicial (Opcional)</label>
                <textarea 
                  placeholder="Envie uma mensagem de boas-vindas..."
                  value={newChatInitialMessage}
                  onChange={(e) => setNewChatInitialMessage(e.target.value)}
                  rows={3}
                  className="input-noir resize-none rounded-xl py-2.5"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsNewChatModalOpen(false);
                    setNewChatName("");
                    setNewChatPhone("");
                    setNewChatInitialMessage("");
                  }}
                  className="btn-noir-secondary flex-1 rounded-xl py-2.5 text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingNewChat}
                  className="btn-noir flex-1 rounded-xl py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmittingNewChat ? "Criando..." : "Iniciar Conversa"}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
      <p className="text-sm text-zinc-200 mt-1 break-words">{value}</p>
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: TaskData; onToggle: () => void }) {
  const isDone = task.status === "DONE";
  const priorityStyles: Record<string, string> = {
    URGENT: "text-red-400 bg-red-500/10 border-red-500/20",
    HIGH: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    MEDIUM: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    LOW: "text-zinc-500 bg-zinc-700/30 border-zinc-600/30",
  };

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors ${isDone ? "opacity-55" : "hover:border-white/10"}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isDone ? "border-emerald-500 bg-emerald-500/20" : "border-zinc-600 hover:border-zinc-300"
          }`}
          title={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
        >
          {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold leading-snug ${isDone ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{task.title}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{task.due}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${priorityStyles[task.priority] || priorityStyles.MEDIUM}`}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

function AnalysisPanel({ 
  result, 
  analysisId,
  onCopy, 
  copiedId,
  onCreateTask,
}: { 
  result: AnalysisResponse; 
  analysisId?: string;
  onCopy: (t: string, id: string) => void; 
  copiedId: string | null; 
  onCreateTask?: (title: string, description: string, priority: string, dueAt?: string) => void;
}) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(result.summary);
  const [nextStep, setNextStep] = useState(result.nextConcreteStep);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSummary(result.summary);
    setNextStep(result.nextConcreteStep);
  }, [result]);

  const handleLocalSave = async () => {
    if (!analysisId) return;
    setIsSaving(true);
    try {
      const { updateAnalysis } = await import("@/actions/crm");
      await updateAnalysis(analysisId, {
        summary,
        nextConcreteStep: nextStep
      });
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar análise.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = summary !== result.summary || nextStep !== result.nextConcreteStep;

  const leadLabels: Record<string, string> = {
    LEAD_FRIO: "Frio",
    LEAD_MORNO: "Morno",
    LEAD_QUENTE: "Quente",
    CLIENTE_NEGOCIACAO: "Negociação",
    CLIENTE_TRAVADO: "Travado",
    CLIENTE_PERDIDO: "Perdido",
    CLIENTE_FECHADO: "Fechado",
  };

  const leadColors: Record<string, string> = {
    LEAD_FRIO: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
    LEAD_MORNO: "text-amber-500 border-amber-500/30 bg-amber-500/10",
    LEAD_QUENTE: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    CLIENTE_NEGOCIACAO: "text-violet-400 border-violet-500/30 bg-violet-500/10",
    CLIENTE_TRAVADO: "text-red-400 border-red-500/30 bg-red-500/10",
    CLIENTE_PERDIDO: "text-zinc-500 border-zinc-600/30 bg-zinc-600/10",
    CLIENTE_FECHADO: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  };

  const riskColors: Record<string, string> = {
    BAIXO: "text-emerald-400",
    MODERADO: "text-amber-400",
    ALTO: "text-red-400",
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-wrap gap-2">
        <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${leadColors[result.leadClassification] || "text-zinc-400 border-zinc-700 bg-zinc-800"}`}>
          {leadLabels[result.leadClassification] || result.leadClassification}
        </span>
        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-white/10 bg-white/5 text-zinc-300">
          {getStageDisplay(result.stage)}
        </span>
        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-white/10 bg-white/5 text-zinc-400">
          Urgência: {result.urgency}
        </span>
        <span className={`px-2.5 py-1 rounded-md text-[11px] font-medium border border-white/10 bg-white/5 ${riskColors[result.riskLevel] || "text-zinc-400"}`}>
          Risco: {result.riskLevel}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <SectionTitle>Resumo Executivo</SectionTitle>
          {hasChanges && (
            <button 
              onClick={handleLocalSave} 
              disabled={isSaving}
              className="text-[10px] text-emerald-400 font-bold hover:text-emerald-300 flex items-center gap-1"
            >
              <Save className="w-3 h-3" /> {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>
          )}
        </div>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full text-sm text-zinc-300 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/5 focus:outline-none focus:border-white/10 min-h-24 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <SectionTitle><AlertCircle className="w-3 h-3 inline mr-1 text-red-400/70" />Objeções</SectionTitle>
          <ul className="text-[13px] space-y-1">
            {result.explicitObjections?.map((obj, i) => (
              <li key={i} className="flex items-start gap-1.5 text-zinc-400">
                <span className="text-red-500/60 mt-1">•</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <SectionTitle><EyeOff className="w-3 h-3 inline mr-1 text-amber-400/70" />Implícitas</SectionTitle>
          <ul className="text-[13px] space-y-1">
            {result.implicitObjections?.map((obj, i) => (
              <li key={i} className="flex items-start gap-1.5 text-zinc-500">
                <span className="text-amber-500/50 mt-1">•</span>
                <span className="italic">{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-1.5">
        <SectionTitle><TrendingUp className="w-3 h-3 inline mr-1 text-emerald-400/70" />Sinais de Compra</SectionTitle>
        <ul className="text-[13px] space-y-1">
          {result.buyingSignals?.map((signal, i) => (
            <li key={i} className="flex items-start gap-1.5 text-zinc-400">
              <span className="text-emerald-500/50 mt-1">✓</span>
              <span>{signal}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <SectionTitle><Eye className="w-3 h-3 inline mr-1" />Postura Recomendada</SectionTitle>
        <p className="text-[13px] text-zinc-300 border-l-2 border-emerald-500/40 pl-3 leading-relaxed">{result.recommendedPosture}</p>
      </div>

      <div className="space-y-1.5">
        <SectionTitle><ShieldAlert className="w-3 h-3 inline mr-1 text-red-400/70" />O que Evitar</SectionTitle>
        <p className="text-[13px] text-zinc-400 border-l-2 border-red-500/30 pl-3 leading-relaxed">{result.whatToAvoid}</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle><ArrowRight className="w-3 h-3 inline mr-1 text-zinc-300" />Próximo Passo</SectionTitle>
          {onCreateTask && nextStep.trim() && (
            <button
              type="button"
              onClick={() => onCreateTask(
                nextStep,
                `Criada a partir da análise IA. Urgência: ${result.urgency}. Risco: ${result.riskLevel}.`,
                result.urgency === "CRITICA" || result.riskLevel === "ALTO" ? "URGENT" : result.urgency === "ALTA" ? "HIGH" : "MEDIUM",
                getDueAtFromTimeWindow(result.timeWindow)
              )}
              className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              Virar tarefa
            </button>
          )}
        </div>
        <textarea
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          className="w-full text-sm text-zinc-200 font-medium leading-relaxed bg-transparent border-none focus:outline-none resize-none p-0"
        />
      </div>

      <div className="space-y-3 pt-3 border-t border-white/5">
        <SectionTitle>Drafts de Resposta</SectionTitle>
        <ReplyCard label="Ação Direta" color="emerald" text={result.suggestedReplies.direct} onCopy={onCopy} copiedId={copiedId} id="direct" />
        <ReplyCard label="Consultiva" color="zinc" text={result.suggestedReplies.consultative} onCopy={onCopy} copiedId={copiedId} id="consultative" />
        <ReplyCard label="WhatsApp Curta" color="blue" text={result.suggestedReplies.whatsappShort} onCopy={onCopy} copiedId={copiedId} id="short" />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center">{children}</h3>;
}

function ReplyCard({ label, color, text, onCopy, copiedId, id }: { label: string; color: string; text: string; onCopy: (t: string, id: string) => void; copiedId: string | null; id: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    zinc: "text-zinc-400 bg-zinc-700/30 border-zinc-600/30",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] p-3.5 rounded-lg space-y-2.5 hover:border-white/10 transition-colors">
      <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded border ${colorMap[color]}`}>{label}</span>
      <p className="text-[13px] text-zinc-300 leading-relaxed">&quot;{text}&quot;</p>
      <button
        onClick={() => onCopy(text, id)}
        className="text-[11px] bg-white/5 hover:bg-white/10 text-zinc-400 px-3 py-1.5 rounded-md transition-colors border border-white/[0.06] font-medium flex items-center gap-1.5"
      >
        <Copy className="w-3 h-3" />
        {copiedId === id ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

function MessageBubble({ 
  msg, 
  onContextMenu, 
  onReactionClick, 
  onStartChat,
  onImageClick,
  avatarUrl,
  forwardMode,
  isSelected,
  onToggleSelect,
  contactId,
  onContactUpdate,
}: { 
  msg: ConversationMessage; 
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  onReactionClick?: (id: string) => void;
  onStartChat?: (phone: string, name: string) => void;
  onImageClick?: (url: string) => void;
  avatarUrl?: string | null;
  forwardMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  contactId?: string;
  onContactUpdate?: (updates: { email?: string; address?: string }) => void;
}) {
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [rescuedMediaUrl, setRescuedMediaUrl] = useState<string | null>(null);
  const [isRescuing, setIsRescuing] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSavingEntity, setIsSavingEntity] = useState(false);
  
  const isOutbound = msg.direction === "outbound";
  const safeMessageMediaUrl = msg.mediaUrl && !isTemporaryWhatsAppMediaUrl(msg.mediaUrl) ? msg.mediaUrl : null;
  const currentMediaUrl = rescuedMediaUrl || safeMessageMediaUrl;
  const hasMedia = !!currentMediaUrl;
  const currentDownloadUrl = currentMediaUrl ? `${currentMediaUrl}${currentMediaUrl.includes("?") ? "&" : "?"}download=1` : null;

  const smartEntities = React.useMemo(() => {
    return extractSmartEntities(msg.text || "");
  }, [msg.text]);

  const handleAddSmartEntity = async (entity: SmartEntity) => {
    if (!contactId || isSavingEntity) return;
    setIsSavingEntity(true);
    
    try {
      if (entity.type === 'email') {
        onContactUpdate?.({ email: entity.value });
        await updateContactEmail(contactId, entity.value);
        showToast("Email adicionado ao contato com sucesso!", "success");
      } else if (entity.type === 'address') {
        onContactUpdate?.({ address: entity.value });
        await updateContactAddress(contactId, entity.value);
        showToast("Endereço adicionado ao contato com sucesso!", "success");
      } else if (entity.type === 'maps_link') {
        showToast("Buscando endereço no Google Maps...", "info");
        const res = await resolveGoogleMapsAddress(entity.value);
        if (res.success && res.address) {
           onContactUpdate?.({ address: res.address });
           await updateContactAddress(contactId, res.address);
           showToast("Endereço salvo com sucesso!", "success");
        } else {
           showToast("Não foi possível extrair o endereço do link.", "error");
        }
      } else if (entity.type === 'phone') {
        const phone = entity.phoneNormalized || entity.value.replace(/\D/g, '');
        showToast("Número salvo no contato!", "success");
        onStartChat?.(phone, "");
      } else if (entity.type === 'url') {
        window.open(entity.value, '_blank', 'noreferrer');
      }
    } catch (err) {
       console.error("Error saving entity:", err);
       showToast("Erro ao salvar informação.", "error");
    } finally {
       setIsSavingEntity(false);
    }
  };

  const handlePhoneEntity = (phone: string, phoneNormalized: string) => {
    if (contactId) {
      onStartChat?.(phoneNormalized, "");
      showToast("Abrindo WhatsApp...", "info");
    }
  };

  const reactionEmojis = msg.reactions && typeof msg.reactions === 'object'
    ? Object.keys(msg.reactions).filter(Boolean)
    : [];

  const handleRescueMedia = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRescuing) return;
    setIsRescuing(true);
    try {
      const res = await fetch(`/api/media/${msg.id}`);
      const data = await res.json();
      if (data.success && data.mediaUrl) {
        setRescuedMediaUrl(data.mediaUrl);
      } else {
        showToast(data.error || "Não foi possível carregar a mídia.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar mídia.", "error");
    } finally {
      setIsRescuing(false);
    }
  };
  
  // Labels that should be hidden when media is present
  const mediaLabels = ["Mensagem de áudio", "Imagem enviada", "Documento enviado", "Figurinha", "Vídeo enviado", "Imagem", "Vídeo", "Documento", "Mídia enviada (image)", "Mídia enviada (video)", "Mídia enviada (audio)", "Mídia enviada (document)"];
  const isMediaLabel = mediaLabels.some(label => msg.text?.includes(label));
  
  return (
    <div className="flex w-full items-center gap-2">
      {forwardMode && (
        <div 
          className="flex-shrink-0 cursor-pointer p-2 -ml-2"
          onClick={() => onToggleSelect?.(msg.id)}
        >
          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-500 hover:border-zinc-300'}`}>
            {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
          </div>
        </div>
      )}
      <div 
        id={msg.id}
        className={`flex w-full ${isOutbound ? "justify-end" : "justify-start"} group relative ${reactionEmojis.length > 0 ? "mb-2" : ""}`}
        onContextMenu={(e) => onContextMenu?.(e, msg.id)}
        onClick={() => {
          if (forwardMode) onToggleSelect?.(msg.id);
        }}
      >
      <div className={`flex items-end gap-1.5 max-w-[85%] ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
        {!isOutbound && (
          <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/5 flex-shrink-0 overflow-hidden mt-1">
            {avatarUrl ? (
              <SafeAvatar src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500 font-bold">
                {msg.text?.substring(0, 1) || "C"}
              </div>
            )}
          </div>
        )}

        <div className={`rounded px-3 py-2 relative ${isOutbound ? "chat-bubble-sent bg-zinc-800 text-zinc-100 rounded-tr-none shadow-sm" : "chat-bubble-received bg-[#0c0c0e] text-zinc-300 rounded-tl-none border border-zinc-850"}`}>
          
          {/* Reaction Button (appears on hover) */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onReactionClick?.(msg.id);
            }}
            className={`absolute top-0 -translate-y-1/2 p-1 rounded-full bg-zinc-900 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-zinc-800 ${isOutbound ? "left-0 -translate-x-full" : "right-0 translate-x-full"}`}
          >
            <Smile className="w-3 h-3 text-zinc-400" />
          </button>

          {/* === IMAGE === */}
          {msg.type === "IMAGE" && (
            hasMedia ? (
              <>
                <img onClick={() => setIsLightboxOpen(true)} onError={() => { setRescuedMediaUrl(null); showToast("Imagem indisponível. Tente carregar novamente.", "error"); }} src={currentMediaUrl!} alt="Imagem" className="max-w-full rounded-lg mb-0.5 object-contain max-h-[200px] cursor-pointer" loading="lazy" />
                {isLightboxOpen && (
                  <div className="modal-overlay fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4" onClick={() => setIsLightboxOpen(false)}>
                    <img src={currentMediaUrl!} alt="Imagem Ampliada" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
              </>
            ) : (
              <button onClick={handleRescueMedia} disabled={isRescuing} className={`flex items-center gap-2 p-1.5 rounded-lg mb-0.5 hover:bg-black/10 transition-colors w-full ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                  {isRescuing ? <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <Eye className="w-3 h-3 text-blue-400" />}
                </div>
                <span className="text-[10px] opacity-80 text-left flex-1 font-semibold">{isRescuing ? "Baixando..." : "Carregar Imagem"}</span>
              </button>
            )
          )}
          
          {/* === STICKER === */}
          {msg.type === "STICKER" && (
            hasMedia ? (
              <img src={currentMediaUrl!} onError={() => { setRescuedMediaUrl(null); showToast("Figurinha indisponível. Tente carregar novamente.", "error"); }} alt="Figurinha" className="w-24 h-24 mb-0.5 object-contain" loading="lazy" />
            ) : (
              <button onClick={handleRescueMedia} disabled={isRescuing} className="flex items-center gap-1.5 mb-0.5 hover:opacity-80 transition-opacity">
                <span className="text-xl">{isRescuing ? "⏳" : "🏷️"}</span>
                <span className="text-[10px] font-semibold">{isRescuing ? "Carregando..." : "Carregar Figurinha"}</span>
              </button>
            )
          )}

          {/* === AUDIO === */}
          {msg.type === "AUDIO" && (
            hasMedia ? (
              <div className="mb-0.5">
                <CustomAudioPlayer src={currentMediaUrl!} />
                {msg.text && !isMediaLabel && (
                  <div className="mt-0.5 bg-black/10 border border-black/5 rounded-md p-1 text-[11px] text-zinc-300 italic border-l-2 border-l-emerald-500/50">
                    <span className="font-semibold text-[8px] text-emerald-500/80 uppercase not-italic block mb-0.5">Transcrição IA:</span>
                    {msg.text}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full">
                <button onClick={handleRescueMedia} disabled={isRescuing} className={`flex items-center gap-2 p-1.5 rounded-lg mb-0.5 hover:bg-black/10 transition-colors w-full text-left ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    {isRescuing ? <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="text-[10px] font-semibold">{isRescuing ? "Baixando..." : "Carregar Áudio"}</span>
                  </div>
                </button>
                {msg.text && !isMediaLabel && (
                  <div className="mt-1 bg-black/10 border border-black/5 rounded-md p-1 text-[11px] text-zinc-300 italic border-l-2 border-l-emerald-500/50">
                    <span className="font-semibold text-[8px] text-emerald-500/80 uppercase not-italic block mb-0.5">Transcrição IA:</span>
                    {msg.text}
                  </div>
                )}
              </div>
            )
          )}

          {/* === VIDEO === */}
          {msg.type === "VIDEO" && (
            hasMedia ? (
              <video src={currentMediaUrl!} controls preload="metadata" className="max-w-full rounded-lg mb-0.5 max-h-[200px]">
              </video>
            ) : (
              <button onClick={handleRescueMedia} disabled={isRescuing} className={`flex items-center gap-2 p-1.5 rounded-lg mb-0.5 hover:bg-black/10 transition-colors w-full text-left ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center">
                  {isRescuing ? <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> : <Play className="w-3 h-3 text-violet-400" />}
                </div>
                <span className="text-[10px] opacity-80 text-left flex-1 font-semibold">{isRescuing ? "Baixando..." : "Carregar Vídeo"}</span>
              </button>
            )
          )}

          {/* === DOCUMENT === */}
          {msg.type === "DOCUMENT" && (
            hasMedia ? (
              <a href={currentDownloadUrl!} download={(isMediaLabel ? "documento" : msg.text) || "documento"} className={`flex items-center gap-1.5 p-1.5 rounded-lg mb-0.5 border ${isOutbound ? "bg-black/5 border-black/10 hover:bg-black/10" : "bg-white/5 border-white/10 hover:bg-white/10"} transition-colors`}>
                <div className={`p-1 rounded-md ${isOutbound ? "bg-white" : "bg-[#27272a]"}`}>
                  <Paperclip className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold truncate">{isMediaLabel ? "Documento" : msg.text}</p>
                </div>
              </a>
            ) : (
              <button onClick={handleRescueMedia} disabled={isRescuing} className={`flex items-center gap-1.5 p-1.5 rounded-lg mb-0.5 hover:bg-black/10 transition-colors w-full text-left ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className={`p-1 rounded-md ${isOutbound ? "bg-white" : "bg-[#27272a]"} flex items-center justify-center`}>
                  {isRescuing ? <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> : <Paperclip className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold truncate">{isMediaLabel ? "Documento" : msg.text}</p>
                </div>
              </button>
            )
          )}

          {isMediaMessageType(msg.type) && msg.mediaStatus === "FAILED" && !hasMedia && (
            <p className="text-[10px] text-red-300 mt-1">Mídia indisponível: {msg.mediaError || "falha no processamento"}</p>
          )}

          {/* === CONTACT CARD === */}
          {msg.type === "CONTACT" && (
            (() => {
              let contacts: { name: string; phone: string }[] = [];
              try {
                const targetText = msg.content || msg.text;
                if (targetText) {
                  if (targetText.trim().startsWith('{')) {
                    const parsed = JSON.parse(targetText);
                    contacts = parsed.contacts || (parsed.name ? [parsed] : []);
                  } else {
                    const match = targetText.match(/Contato:\s*(.*?)\s*\((.*?)\)/);
                    if (match) {
                      contacts = [{ name: match[1], phone: match[2] }];
                    } else {
                      contacts = [{ name: targetText.replace("Contato:", "").trim(), phone: "" }];
                    }
                  }
                }
              } catch (e) {
                contacts = [{ name: msg.text || "Contato", phone: "" }];
              }

              if (contacts.length === 0) return null;

              if (contacts.length === 1) {
                const c = contacts[0];
                return (
                  <div className={`p-2.5 rounded-lg border ${isOutbound ? "bg-black/5 border-black/10 text-black" : "bg-zinc-900 border-zinc-800 text-white"} min-w-[200px] max-w-[260px] shadow-sm`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isOutbound ? "bg-zinc-800 text-white" : "bg-zinc-100 text-black"} font-bold text-[10px] shadow`}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[11px] truncate">{c.name}</h4>
                        <p className={`text-[9px] ${isOutbound ? "text-black/60" : "text-zinc-400"} truncate`}>{c.phone ? `+${c.phone}` : "Sem telefone"}</p>
                      </div>
                    </div>
                    
                    {c.phone && onStartChat && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartChat(c.phone, c.name);
                        }}
                        className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                          isOutbound ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "bg-zinc-100 hover:bg-white text-black"
                        }`}
                      >
                        <UserPlus className="w-3 h-3" />
                        Conversar
                      </button>
                    )}
                  </div>
                );
              }

              if (!isExpanded) {
                return (
                  <div className={`p-2.5 rounded-lg border ${isOutbound ? "bg-black/5 border-black/10 text-black" : "bg-zinc-900 border-zinc-800 text-white"} min-w-[200px] max-w-[260px] shadow-sm space-y-2`}>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2 shrink-0">
                        {contacts.slice(0, 3).map((c, i) => (
                          <div 
                            key={i} 
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[9px] shadow-md border ${
                              isOutbound ? "bg-zinc-800 text-white border-zinc-900" : "bg-zinc-100 text-black border-zinc-900"
                            }`}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[11px] truncate">{contacts[0].name} e {contacts.length - 1} outros</h4>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsExpanded(true)}
                      className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                        isOutbound ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "bg-zinc-100 hover:bg-white text-black"
                      }`}
                    >
                      Ver todos
                    </button>
                  </div>
                );
              }

              return (
                <div className={`p-2.5 rounded-lg border ${isOutbound ? "bg-black/5 border-black/10 text-black" : "bg-zinc-900 border-zinc-800 text-white"} min-w-[220px] max-w-[260px] shadow-sm space-y-2`}>
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-850">
                    <span className="text-[9px] font-semibold text-zinc-400">Contatos ({contacts.length})</span>
                    <button onClick={() => setIsExpanded(false)} className="text-[9px] font-bold text-amber-500">Recolher</button>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto pr-1 space-y-2 divide-y divide-white/[0.04]">
                    {contacts.map((c, index) => (
                      <div key={index} className="flex items-center gap-2 pt-1.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isOutbound ? "bg-zinc-800 text-white" : "bg-zinc-100 text-black"} font-bold text-xs shadow`}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-xs truncate">{c.name}</h4>
                        </div>
                         {c.phone && onStartChat && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartChat(c.phone, c.name);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isOutbound 
                                ? "bg-zinc-900 hover:bg-zinc-800 text-white" 
                                : "bg-zinc-100 hover:bg-white text-black"
                            }`}
                            title="Conversar"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}

          {/* === TEXT === */}
          {msg.text && !(isMediaLabel && (msg.type !== "TEXT")) && msg.type === "TEXT" && (
            <SmartText text={msg.text} contactId={contactId} onPhoneAction={handlePhoneEntity} />
          )}
          
          {/* === CAPTION === */}
          {msg.text && !isMediaLabel && msg.type !== "TEXT" && msg.type !== "DOCUMENT" && msg.type !== "AUDIO" && (
            <SmartText text={msg.text} contactId={contactId} onPhoneAction={handlePhoneEntity} />
          )}

          {/* === REACTION BADGE === */}
          {reactionEmojis.length > 0 && (
            <div 
              className={`absolute bottom-[-10px] ${isOutbound ? 'left-3' : 'right-3'} flex items-center gap-0.5 rounded-full border border-white/10 bg-[#09090b] px-1.5 py-0.5 shadow-lg z-10 text-[10px] select-none hover:scale-105 transition-transform cursor-pointer`}
              onClick={(e) => {
                e.stopPropagation();
                onReactionClick?.(msg.id);
              }}
            >
              {reactionEmojis.map(emoji => (
                <span key={emoji}>{emoji}</span>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-1 mt-0.5 ${isOutbound ? "justify-end text-zinc-400" : "text-zinc-500"}`}>
            {msg.isEdited && (
              <span className="text-[9px] opacity-65 italic mr-1 select-none">editada</span>
            )}
            <MessageTime timestamp={msg.timestamp} fallback={msg.time} />
            {isOutbound && (
              <div className="flex items-center gap-0.5">
                {msg.status === "SENT" && <Check className="w-3 h-3 opacity-80" />}
                {msg.status === "DELIVERED" && <CheckCheck className="w-3 h-3 opacity-80" />}
                {msg.status === "READ" && <CheckCheck className="w-3 h-3 text-blue-500 drop-shadow-sm opacity-90" />}
                {msg.status === "PENDING" && <Clock className="w-3 h-3 opacity-50" />}
                {!msg.status && <CheckCheck className="w-3 h-3 opacity-80" />}
              </div>
            )}
          </div>
        </div>

        {/* Smart Entities Actions */}
        {smartEntities.length > 0 && (
          <div className={`flex flex-col gap-1 mb-1 transition-opacity ${isOutbound ? 'items-end' : 'items-start'} opacity-20 hover:opacity-100 group-hover:opacity-100`}>
             {smartEntities.map((entity, idx) => (
                <button
                   key={idx}
                   onClick={() => handleAddSmartEntity(entity)}
                   disabled={isSavingEntity}
                   className="p-1.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center justify-center group/btn relative"
                >
                   {isSavingEntity ? (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500/50 border-t-transparent rounded-full animate-spin" />
                   ) : entity.type === 'email' ? (
                      <Mail className="w-3.5 h-3.5" />
                   ) : entity.type === 'phone' ? (
                      <Phone className="w-3.5 h-3.5" />
                   ) : entity.type === 'url' ? (
                      <ExternalLink className="w-3.5 h-3.5" />
                   ) : (
                      <MapPin className="w-3.5 h-3.5" />
                   )}
                   <span className="absolute whitespace-nowrap bg-zinc-900 text-[10px] font-medium border border-white/10 px-2 py-0.5 rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity -top-7 shadow-lg z-20">
                      {entity.type === 'email' ? 'Salvar Email' :
                       entity.type === 'phone' ? 'Iniciar Conversa' :
                       entity.type === 'url' ? 'Abrir Link' :
                       entity.type === 'maps_link' ? 'Extrair Endereço' :
                       'Salvar Endereço'}
                   </span>
                </button>
             ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function ConversationTime({ timestamp, fallback }: { timestamp: string; fallback: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{fallback}</span>;
  }

  try {
    if (!timestamp) return <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{fallback}</span>;
    const value = new Date(timestamp);
    const now = new Date();
    const dayDelta = Math.floor((now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24));
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);

    let display = fallback;
    if (dayDelta <= 0 && value.toDateString() === now.toDateString()) {
      display = `Hoje ${time}`;
    } else {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (value.toDateString() === yesterday.toDateString()) {
        display = `Ontem ${time}`;
      } else if (dayDelta < 7) {
        display = `${new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(value)} ${time}`;
      } else {
        display = new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }).format(value);
      }
    }
    return <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{display}</span>;
  } catch {
    return <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{fallback}</span>;
  }
}
