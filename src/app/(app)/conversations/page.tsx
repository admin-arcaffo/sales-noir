"use client";

import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Copy,
  Eye,
  EyeOff,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Pencil,
  Phone,
  Play,
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
  getContactProfile,
  updateContactProfile,
  updateConversationTemperature,
  getProducts,
  getLeadOrigins,
  startNewConversation,
  getPipelineStages,
  syncAfterReconnect,
  type ConversationAnalysisData,
  type ConversationData,
  type ConversationMessage,
  type ProductData,
  type PipelineStageData,
} from "@/actions/crm";
import type { AnalysisResponse } from "@/lib/ai/prompts";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const STATUS_COLORS = {
  hot: "bg-amber-500",
  warm: "bg-yellow-400",
  cold: "bg-blue-500",
};

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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sellerContext, setSellerContext] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftStage, setDraftStage] = useState("PRIMEIRO_CONTATO");
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncTimeRef = useRef<string | null>(null);
  
  // Custom sidebar metadata dropdown states
  const [products, setProducts] = useState<ProductData[]>([]);
  const [leadOrigins, setLeadOrigins] = useState<{ id: string; name: string }[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageData[]>([]);
  const [draftProduct, setDraftProduct] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [draftOrigin, setDraftOrigin] = useState("");
  const [isSavingOrigin, setIsSavingOrigin] = useState(false);
  const [isSavingTemp, setIsSavingTemp] = useState(false);

  // Scheduled Messages States
  const [scheduleGlobalDate, setScheduleGlobalDate] = useState("");
  const [scheduleGlobalTime, setScheduleGlobalTime] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState([{ id: Date.now().toString(), content: "" }]);
  const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);

  // Unread messages tracking
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>({});
  const [connectionStatus, setConnectionStatus] = useState<string>("CONNECTED");

  // Nova Conversa modal states
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatInitialMessage, setNewChatInitialMessage] = useState("");
  const [isSubmittingNewChat, setIsSubmittingNewChat] = useState(false);
  
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

  // Edit Contact Name states
  const [isEditingContactName, setIsEditingContactName] = useState(false);
  const [editedContactNameValue, setEditedContactNameValue] = useState("");

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

  // Load cached conversations and last read map from localStorage on mount for instant visual load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("sales_arcaffo_conversations");
        const cachedSync = localStorage.getItem("sales_arcaffo_last_sync_time");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConversations(parsed);
            setIsLoading(false);
            if (cachedSync) {
              lastSyncTimeRef.current = cachedSync;
            }
          }
        }
        
        const cachedRead = localStorage.getItem("sales_arcaffo_last_read_map");
        if (cachedRead) {
          setLastReadMap(JSON.parse(cachedRead));
        }
      } catch (e) {
        console.error("Failed to load cached conversations from localStorage", e);
      }
    }
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
  }, [selectedConvo]);

  // Save lastReadMap to localStorage
  useEffect(() => {
    if (Object.keys(lastReadMap).length > 0 && typeof window !== "undefined") {
      try {
        localStorage.setItem("sales_arcaffo_last_read_map", JSON.stringify(lastReadMap));
      } catch (e) {
        console.error("Failed to save lastReadMap to localStorage", e);
      }
    }
  }, [lastReadMap]);

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
        const cacheFriendlyList = conversations.map(c => ({
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
  
  // Estados de Colapso das Áreas
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileCollapsed, setIsProfileCollapsed] = useState(false);
  const [isAnalysisCollapsed, setIsAnalysisCollapsed] = useState(false);

  // Auto-scroll to bottom when messages change
  const activeConvo = conversations.find((conversation) => conversation.id === selectedConvo) || null;
  
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConvo?.messages.length, selectedConvo]);

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
      alert("Falha ao encaminhar mensagens.");
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

  const showNotification = (message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const checkScheduledNotifications = async () => {
    try {
      const { getUnnotifiedScheduledMessages, markScheduledMessagesAsNotified } = await import("@/actions/crm");
      const unnotified = await getUnnotifiedScheduledMessages();
      if (unnotified && unnotified.length > 0) {
        for (const msg of unnotified) {
          showNotification(`Mensagem agendada enviada para ${msg.conversation.contact.name}: "${msg.content.substring(0, 30)}..."`);
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
      setScheduleGlobalDate("");
      setScheduleGlobalTime("");
    } catch (err) {
      console.error("Failed to load scheduled messages", err);
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedConvo) return;
    setIsSavingSchedule(true);
    try {
      const { scheduleMessages } = await import("@/actions/crm");
      
      if (!scheduleGlobalDate || !scheduleGlobalTime) {
        alert("Preencha a data e hora globais para o agendamento.");
        setIsSavingSchedule(false);
        return;
      }

      const validMessages = scheduledMessages.filter(item => item.content.trim());
      if (validMessages.length === 0) {
        alert("Preencha ao menos uma mensagem para agendar.");
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
        alert("A data e hora devem ser no futuro. Ajuste o agendamento.");
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
      
      await scheduleMessages(selectedConvo, messagesToSchedule);
      alert("Agendamento salvo com sucesso!");
      void loadScheduledMessages(selectedConvo);
      setIsScheduleOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao salvar agendamento.");
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
      alert("Erro ao cancelar: " + err.message);
    }
  };

  const selectConversation = (conversationId: string, source: ConversationData[]) => {
    const conversation = source.find((item) => item.id === conversationId);
    setSelectedConvo(conversationId);
    setDraftStage(conversation?.stageKey || "PRIMEIRO_CONTATO");
    setNotesDraft(conversation?.notes || "");
    setDraftProduct(conversation?.productId || "");
    setDraftOrigin(conversation?.origin || "");
    setAnalysisResult(conversation?.latestAnalysis || null);
    setDraftMessage("");

    // Load scheduled messages for this conversation
    void loadScheduledMessages(conversationId);
  };

  const handleSaveContactName = async () => {
    if (!editedContactNameValue.trim() || !activeConvo) return;
    try {
      await updateContactProfile(activeConvo.contactId, { name: editedContactNameValue.trim() });
      
      // Update local state instantly
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
      
      // Re-fetch conversations to keep selected states fully updated
      const resultData = await getConversations();
      setConversations(resultData.conversations);
      
      setIsEditingContactName(false);
    } catch (e) {
      alert("Erro ao salvar nome do contato.");
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
        alert("Número de telefone inválido.");
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
      alert(e?.message || "Erro ao iniciar conversa.");
    } finally {
      setIsSubmittingNewChat(false);
    }
  };

  const handleManualSync = async (isAuto = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    if (!isAuto) showNotification("Iniciando sincronização...");
    try {
      const res = await syncAfterReconnect();
      if (res.success) {
        showNotification(`Sincronização concluída: ${res.newMessages} novas mensagens importadas.`);
        // Force full refresh
        lastSyncTimeRef.current = null;
        const resultData = await getConversations();
        setConversations(resultData.conversations);
      } else {
        if (!isAuto) showNotification(`Falha na sincronização: ${res.error || res.reason}`);
      }
    } catch (e) {
      console.error(e);
      if (!isAuto) showNotification("Erro ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNewChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim()) {
      alert("Por favor, insira o nome do contato.");
      return;
    }
    if (!newChatPhone.trim()) {
      alert("Por favor, insira o número de telefone.");
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
        selectConversation(result.conversationId, resultData.conversations);
        setIsNewChatModalOpen(false);
        setNewChatName("");
        setNewChatPhone("");
        setNewChatInitialMessage("");
      }
    } catch (e: any) {
      alert(e?.message || "Erro ao criar nova conversa.");
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
          ? { ...c, messages: c.messages.map(m => m.id === editingMsg.id ? { ...m, text: editingMsg.text } : m) }
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
      await sendMessageReaction(activeConvo.id, msgId, emoji);
      // Otimista: poderíamos adicionar a reação localmente, mas por enquanto vamos esperar o webhook/polling
    } catch (err) {
      console.error(err);
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
    let alive = true;
    let timeoutId: NodeJS.Timeout;

    // Load initial products, origins and stages
    getProducts().then((p) => { if (alive) setProducts(p); }).catch(console.error);
    getLeadOrigins().then((o) => { if (alive) setLeadOrigins(o); }).catch(console.error);
    getPipelineStages().then((s) => { if (alive) setPipelineStages(s); }).catch(console.error);

    async function refreshData() {
      if (!alive) return;
      try {
        const syncTime = lastSyncTimeRef.current;
        const url = `/api/conversations${syncTime ? `?since=${encodeURIComponent(syncTime)}` : ''}`;
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
        };
        if (!alive) return;

        setConnectionStatus(result.connectionStatus);

        // Detect reconnection and trigger automatic sync
        if (
          prevConnectionStatusRef.current === "DISCONNECTED" && 
          result.connectionStatus === "CONNECTED"
        ) {
          showNotification("WhatsApp reconectado! Sincronizando mensagens perdidas...");
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
            // Merge delta changes
            const updatedMap = new Map(result.conversations.map(c => [c.id, c]));
            const merged = prev.map(c => updatedMap.has(c.id) ? updatedMap.get(c.id)! : c);
            const newItems = result.conversations.filter(c => !prev.some(p => p.id === c.id));
            nextList = [...newItems, ...merged];
          }

          // Sort by the timestamp of the last message (newest first)
          nextList.sort((a, b) => {
            const timeA = a.messages.length > 0 ? new Date(a.messages[a.messages.length - 1].timestamp).getTime() : 0;
            const timeB = b.messages.length > 0 ? new Date(b.messages[b.messages.length - 1].timestamp).getTime() : 0;
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
  }, [selectedConvo]);

  const handleSaveProduct = async (prodId: string) => {
    if (!activeConvo) return;
    setIsSavingProduct(true);
    try {
      await updateContactProfile(activeConvo.contactId, {
        productId: prodId || null,
      });
      setConversations(current => current.map(c => 
        c.id === activeConvo.id ? { ...c, productId: prodId || null } : c
      ));
      setDraftProduct(prodId);
    } catch (err) {
      console.error("Failed to save product:", err);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveOrigin = async (orig: string) => {
    if (!activeConvo) return;
    setIsSavingOrigin(true);
    try {
      await updateContactProfile(activeConvo.contactId, {
        origin: orig || null,
      });
      setConversations(current => current.map(c => 
        c.id === activeConvo.id ? { ...c, origin: orig || null } : c
      ));
      setDraftOrigin(orig);
    } catch (err) {
      console.error("Failed to save origin:", err);
    } finally {
      setIsSavingOrigin(false);
    }
  };

  const handleSaveTemp = async (temp: "HOT" | "WARM" | "COLD") => {
    if (!activeConvo) return;
    setIsSavingTemp(true);
    try {
      await updateConversationTemperature(activeConvo.id, temp);
      setConversations(current => current.map(c => 
        c.id === activeConvo.id ? { ...c, status: temp.toLowerCase() as any } : c
      ));
    } catch (err) {
      console.error("Failed to save temperature:", err);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeConvo) return;
    
    setIsSending(true);
    try {
      // 1. Determine media type
      let mediatype = "document";
      if (file.type.startsWith("image/")) mediatype = "image";
      else if (file.type.startsWith("audio/")) mediatype = "audio";
      else if (file.type.startsWith("video/")) mediatype = "video";

      // 2. Read as Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        try {
          const { sendMediaMessage } = await import("@/actions/crm");
          const newMessage = await sendMediaMessage({
            conversationId: activeConvo.id,
            base64,
            mediatype,
            mimetype: file.type,
            fileName: file.name
          });

          // Optimistic UI update
          setConversations((current) =>
            current.map((c) =>
              c.id === activeConvo.id
                ? { ...c, messages: [...c.messages, newMessage] }
                : c
            )
          );
        } catch (err) {
          console.error("Failed to send media:", err);
          alert("Falha ao enviar arquivo.");
        } finally {
          setIsSending(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            const { sendMediaMessage } = await import("@/actions/crm");
            const newMessage = await sendMediaMessage({
              conversationId: activeConvo!.id,
              base64,
              mediatype: "audio",
              mimetype: "audio/ogg",
            });
            
            setConversations((current) =>
              current.map((c) =>
                c.id === activeConvo!.id
                  ? { ...c, messages: [...c.messages, newMessage] }
                  : c
              )
            );
          } catch (err) {
            console.error("Failed to send audio:", err);
            alert("Erro ao enviar áudio.");
          } finally {
            setIsSending(false);
          }
        };
        reader.readAsDataURL(blob);
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
      alert("Permissão de microfone negada.");
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
      const newMessage = await sendConversationMessage(activeConvo.id, messageText);

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
    try {
      const { updateContactNotes } = await import("@/actions/crm");
      await updateContactNotes(activeConvo.contactId, notesDraft);
      
      setConversations((current) => 
        current.map((c) => c.id === activeConvo.id ? { ...c, notes: notesDraft } : c)
      );
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar anotações.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveStage = async () => {
    if (!activeConvo || draftStage === activeConvo.stageKey) {
      return;
    }

    setIsSavingStage(true);
    try {
      await updateConversationStage(activeConvo.id, draftStage);

      setConversations((current) => current.map((conversation) => (
        conversation.id === activeConvo.id
          ? {
              ...conversation,
              stageKey: draftStage,
              stage: getStageDisplay(draftStage),
            }
          : conversation
      )));
    } catch (error) {
      console.error("Save stage error:", error);
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
        className={`border-r border-border/60 bg-[#0a0a0c] flex-col shrink-0 transition-all duration-300 relative ${
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
        <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-[#09090b] sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-bold text-white uppercase tracking-wider">
              Mensagens
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleManualSync(false)}
              disabled={isSyncing || connectionStatus !== "CONNECTED"}
              title="Sincronizar mensagens pendentes"
              className={`p-2 rounded transition-colors flex items-center justify-center ${
                connectionStatus !== "CONNECTED" ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-zinc-400" : ""}`} />
            </button>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded transition-colors flex items-center justify-center"
              title="Nova Conversa"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className={`p-4 border-b border-zinc-900 ${isSidebarCollapsed ? "flex flex-col items-center" : ""}`}>
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all placeholder:text-zinc-600"
                  />
                </div>
                <button
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className={`p-2 rounded-lg border hover:bg-white/10 transition-colors relative ${
                    isFilterExpanded || (filterUnreadOnly || filterStage !== "all" || filterProduct !== "all")
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                  }`}
                  title="Filtros Inteligentes"
                >
                  <Filter className="w-4 h-4" />
                  {(filterUnreadOnly || filterStage !== "all" || filterProduct !== "all") && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all shadow shrink-0"
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
                <div className="mt-1 p-3 bg-white/[0.02] border border-white/5 rounded-lg space-y-3 transition-all duration-200">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider text-[9px] text-zinc-500">Filtros Inteligentes</span>
                    {(filterUnreadOnly || filterStage !== "all" || filterProduct !== "all") && (
                      <button 
                        onClick={() => {
                          setFilterUnreadOnly(false);
                          setFilterStage("all");
                          setFilterProduct("all");
                        }}
                        className="text-[10px] text-amber-500 hover:text-amber-400 transition-colors"
                      >
                        Limpar Todos
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">Estágio</label>
                      <select
                        value={filterStage}
                        onChange={(e) => setFilterStage(e.target.value)}
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded px-1.5 py-1 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700"
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
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded px-1.5 py-1 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700"
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
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
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
                  selectedConvo === convo.id ? "bg-zinc-900 border-l-2 border-l-zinc-400" : "hover:bg-zinc-900/40 border-l-2 border-l-transparent"
                }`}
              >
                {isSidebarCollapsed ? (
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center text-[10px] font-bold text-zinc-300 border border-zinc-700/50 overflow-hidden">
                      {convo.avatarUrl ? (
                        <img src={convo.avatarUrl} alt={convo.name} className="w-full h-full object-cover" />
                      ) : (
                        convo.initials
                      )}
                    </div>
                    {getUnreadCount(convo) > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-[#0a0a0c] flex items-center justify-center">
                        <span className="text-[8px] font-bold text-black">{getUnreadCount(convo)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-zinc-950 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0 border border-zinc-850 overflow-hidden">
                      {convo.avatarUrl ? (
                        <img src={convo.avatarUrl} alt={convo.name} className="w-full h-full object-cover" />
                      ) : (
                        convo.initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className="text-[11px] font-bold text-zinc-300 truncate">{convo.name}</h3>
                        <div className="text-[8px] font-mono text-zinc-650">
                          <ConversationTime timestamp={convo.timestamp || ""} fallback={convo.time} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[convo.status]}`} />
                          <span className="text-[9px] text-zinc-500 font-medium">{convo.stage}</span>
                        </div>
                        {getUnreadCount(convo) > 0 && (
                          <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-amber-500 text-black rounded-full min-w-[16px] h-3.5 flex items-center justify-center shrink-0">
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
            <header className="h-14 border-b border-zinc-900 flex items-center justify-between px-4 md:px-6 bg-[#09090b] shrink-0 z-10">
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
                      <img src={activeConvo.avatarUrl} alt={activeConvo.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-400">{activeConvo.initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold truncate text-white">{activeConvo.name}</h2>
                      {activeConvo.name === activeConvo.phone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditedContactNameValue("");
                            setIsEditingContactName(true);
                            setIsContactProfileModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold uppercase bg-amber-500 hover:bg-amber-400 text-black rounded-md transition-all shrink-0 active:scale-95 shadow-sm"
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
              <div className="flex items-center gap-3 text-zinc-500 shrink-0">
                {!activeConvo.isLead && (
                  <button
                    onClick={async () => {
                      try {
                        const { promoteToLead } = await import('@/actions/crm');
                        await promoteToLead(activeConvo.contactId);
                        setConversations(current => current.map(c => 
                          c.id === activeConvo.id ? { ...c, isLead: true } : c
                        ));
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-md hover:bg-zinc-200 transition-colors"
                  >
                    <Target className="w-3.5 h-3.5" />
                    Qualificar Lead
                  </button>
                )}
                <Phone className="w-4 h-4" />
                <MoreVertical className="w-4 h-4" />
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
                          onContextMenu={(e, id) => {
                            e.preventDefault();
                            setContextMenu({ msgId: id, x: e.pageX, y: e.pageY });
                          }}
                          onReactionClick={(id) => setReactionPicker(id)}
                          onStartChat={(phone, name) => handleStartChatWithPhone(phone, name)}
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

            <footer className="p-3 bg-[#0a0a0c] border-t border-border/40 shrink-0 space-y-2 relative">
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
              
              {isRecording ? (
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 animate-pulse">
                  <div className="flex items-center gap-2 text-red-500">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Gravando: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex-1" />
                  <button 
                    onClick={() => stopRecording(true)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Cancelar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => stopRecording(false)}
                    className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors shadow-lg"
                  >
                    <Check className="w-4 h-4" /> Enviar
                  </button>
                </div>
              ) : editingMsg ? (
                <div className="flex flex-col gap-2 bg-white/5 border border-amber-500/30 rounded-xl p-3">

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Editando Mensagem</span>
                    <button onClick={() => setEditingMsg(null)} className="text-zinc-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <textarea
                      value={editingMsg.text}
                      onChange={(e) => setEditingMsg({ ...editingMsg, text: e.target.value })}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none"
                      rows={2}
                    />
                    <button 
                      onClick={handleUpdateMessage}
                      className="bg-amber-500 text-black p-2 rounded-lg hover:bg-amber-400"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-2 transition-colors ${showEmojiPicker ? "text-amber-500" : "text-zinc-500 hover:text-white"}`}
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    multiple
                  />
                  
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Escreva sua mensagem..."
                      value={draftMessage}
                      onChange={(e) => setDraftMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all"
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
                    className="p-2.5 bg-white text-black rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-lg"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 bg-[#0a0a0c] p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.03)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="w-full max-w-lg space-y-8 animate-in fade-in zoom-in-95 duration-500 relative z-10">
              
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-[0_0_40px_-10px_rgba(245,158,11,0.2)]">
                  <MessageSquare className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Nexus Copilot</h3>
                <p className="text-zinc-400 max-w-sm mx-auto">Sua central de atendimento avançada. Escolha uma conversa ao lado para começar.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-2xl font-bold text-white mb-1">{conversations.length}</div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Total</div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-2xl font-bold text-amber-500 mb-1">
                    {conversations.reduce((acc, c) => acc + (getUnreadCount(c) > 0 ? 1 : 0), 0)}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-amber-500/70">Não Lidas</div>
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
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95"
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
        className={`bg-[#0a0a0c] flex flex-col shrink-0 transition-all duration-300 z-20 ${
          isAnalysisCollapsed 
            ? "w-12 border-l border-white/[0.06] " 
            : "fixed inset-y-0 right-0 w-full md:relative md:w-[420px] z-40 border-l border-white/10 md:border-white/[0.06] shadow-2xl md:shadow-none"
        }`}
      >
        <div className={`p-5 border-b border-white/[0.06] flex items-center ${isAnalysisCollapsed ? "justify-center" : "justify-between"}`}>
          {!isAnalysisCollapsed ? (
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <BrainCircuit className="w-4 h-4 text-zinc-400" />
                <h2 className="font-semibold text-sm tracking-tight text-zinc-200">Sales Noir</h2>
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
          <div className="p-5 flex-1 overflow-y-auto space-y-5 no-scrollbar">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetaCard label="Mensagens" value={String(activeConvo.messageCount)} />
                <MetaCard label="Telefone" value={activeConvo.phone} />
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
                          ? temp === "HOT" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : temp === "WARM" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" : "text-blue-400 bg-blue-500/10 border-blue-500/20"
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
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
                    className="px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingStage ? "Salvando" : "Salvar"}
                  </button>
                </div>
              </div>

              {/* Produto de Interesse */}
              <div className="space-y-2">
                <SectionTitle>Produto de Interesse</SectionTitle>
                <select
                  value={draftProduct}
                  disabled={isSavingProduct}
                  onChange={(e) => handleSaveProduct(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="">Nenhum / Não definido</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.price ? `- R$ ${p.price}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Origem do Lead */}
              <div className="space-y-2">
                <SectionTitle>Origem do Lead</SectionTitle>
                <select
                  value={draftOrigin}
                  disabled={isSavingOrigin}
                  onChange={(e) => handleSaveOrigin(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-sm text-zinc-400 min-h-28 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-white/10 placeholder:text-zinc-700 resize-none transition-all"
                />
              </div>

              {/* Agendamento de Mensagens */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                  className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Agendar Mensagens
                  </span>
                  <span className="text-[10px] text-zinc-500">{isScheduleOpen ? "▼" : "▲"}</span>
                </button>

                {isScheduleOpen && (
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg space-y-4 animate-in fade-in duration-200">
                    <p className="text-[10px] text-zinc-500">
                      Escolha a data e a hora globais. Você pode agendar várias mensagens para enviar em sequência a partir desse horário.
                    </p>

                    <div className="flex flex-col gap-2 bg-[#0c0c0e] p-3 rounded-lg border border-white/5">
                      <label className="text-[9px] uppercase font-bold tracking-wider text-amber-500 block">
                        Data e Hora do Disparo Inicial
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={scheduleGlobalDate}
                          onChange={(e) => setScheduleGlobalDate(e.target.value)}
                          className="flex-1 bg-[#0a0a0c] border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                        />
                        <input
                          type="time"
                          value={scheduleGlobalTime}
                          onChange={(e) => setScheduleGlobalTime(e.target.value)}
                          className="w-[100px] bg-[#0a0a0c] border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
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
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded p-2 text-xs text-zinc-300 placeholder:text-zinc-700 min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-zinc-600"
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
                            <div key={schedule.id} className="p-2 bg-black/20 rounded border border-white/5 flex flex-col gap-1.5">
                              <p className="text-[10px] text-zinc-300 line-clamp-2">{schedule.content}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] text-zinc-500">
                                  {new Date(schedule.scheduledFor).toLocaleString('pt-BR')}
                                </span>
                                <button
                                  onClick={() => handleCancelSchedule(schedule.id)}
                                  className="text-[9px] text-red-400 hover:text-red-300"
                                >
                                  Cancelar
                                </button>
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
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingSchedule ? "Salvando..." : "Salvar Agendamento"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-5">
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
                  {analysisResult ? <AnalysisPanel result={analysisResult} analysisId={activeConvo.latestAnalysis?.id} onCopy={handleCopy} copiedId={copiedId} /> : null}
                </>
              )}
            </div>
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

        {!isAnalysisCollapsed && (
          <div className="p-4 border-t border-white/[0.06] space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">Direcionamento para a IA</label>
              <textarea
                value={sellerContext}
                onChange={(e) => setSellerContext(e.target.value)}
                placeholder="Qual a situação atual do lead para eu ajudar? (Opcional)"
                className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg p-2.5 text-xs text-zinc-300 placeholder:text-zinc-700 min-h-16 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
              />
            </div>
            <button
              onClick={() => void handleAnalyze()}
              disabled={!selectedConvo || isAnalyzing}
              className="w-full py-3 px-4 bg-white hover:bg-zinc-200 text-black rounded-lg font-semibold text-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.06)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Zap className="w-4 h-4" />
              {isAnalyzing ? "Processando..." : "Analisar Negociação"}
            </button>
          </div>
        )}
      </section>

      {/* Floating UI: Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px] overflow-hidden animate-in fade-in zoom-in duration-100"
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
        <div className="fixed top-0 left-0 right-0 z-[150] bg-zinc-900 border-b border-white/10 p-4 flex items-center justify-between shadow-xl animate-in slide-in-from-top-full duration-200">
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
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Encaminhar <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      )}

      {/* Forward Destination Modal */}
      {isForwardModalOpen && (
        <div 
          className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsForwardModalOpen(false)}
        >
          <div 
            className="bg-[#18181b] border border-white/10 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Encaminhar para...</h3>
              <button 
                onClick={() => setIsForwardModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  value={forwardQuery}
                  onChange={(e) => setForwardQuery(e.target.value)}
                  placeholder="Buscar conversa..."
                  className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50"
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
                        <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
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
          </div>
        </div>
      )}

      {/* Floating UI: Reaction Picker */}
      {reactionPicker && (
        <div 
          className="fixed z-[100] bg-[#18181b] border border-white/10 rounded-full shadow-2xl px-2 py-1.5 flex gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ 
            top: (document.getElementById(reactionPicker)?.getBoundingClientRect().top || 0) - 50,
            left: document.getElementById(reactionPicker)?.getBoundingClientRect().left
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
            <button 
              key={emoji}
              onClick={() => {
                handleReaction(reactionPicker, emoji);
                setReactionPicker(null);
              }}
              className="p-1.5 hover:bg-white/10 rounded-full transition-all hover:scale-125 text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-lg">Meu Perfil WhatsApp</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
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
                    className="mt-2 text-xs font-semibold px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 rounded-xl transition-all"
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
                          <img src={myProfile.picture} alt="Profile" className="w-full h-full object-cover" />
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
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest px-1">Nome no WhatsApp</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          defaultValue={myProfile.name}
                          onBlur={(e) => updateWhatsAppProfile({ name: e.target.value })}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest px-1">Recado (Status)</label>
                      <textarea 
                        defaultValue={myProfile.status}
                        onBlur={(e) => updateWhatsAppProfile({ status: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all resize-none"
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
            </div>
            
            <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="px-6 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all active:scale-95"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Profile Modal (Popup) */}
      {isContactProfileModalOpen && activeConvo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-lg">Perfil do Contato</h3>
              <button onClick={() => setIsContactProfileModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-white/5 mb-4 flex items-center justify-center text-3xl font-bold overflow-hidden shadow-xl">
                  {activeConvo.avatarUrl ? (
                    <img src={activeConvo.avatarUrl} alt={activeConvo.name} className="w-full h-full object-cover" />
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
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-center font-semibold text-white focus:outline-none focus:border-amber-500/50 transition-all max-w-[200px]"
                      autoFocus
                    />
                    <button 
                      onClick={handleSaveContactName}
                      className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setIsEditingContactName(false)}
                      className="p-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all"
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
                    className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-2 cursor-pointer group hover:text-amber-500 transition-all"
                    title="Clique para editar"
                  >
                    <span>{activeConvo.name}</span>
                    <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-500 transition-all" />
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
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2">Anotações do CRM</p>
                  <p className="text-sm text-zinc-400 italic leading-relaxed">
                    {activeConvo.notes || "Nenhuma anotação registrada para este contato."}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end gap-3">
              <button 
                onClick={() => setIsContactProfileModalOpen(false)}
                className="px-6 py-2.5 bg-zinc-800 text-white rounded-xl text-sm font-bold hover:bg-zinc-700 transition-all active:scale-95"
              >
                Fechar
              </button>
              <button 
                onClick={() => {
                  setIsContactProfileModalOpen(false);
                  setIsAnalysisCollapsed(false);
                }}
                className="px-6 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all active:scale-95"
              >
                Ver Análise IA
              </button>
            </div>
          </div>
        </div>
      )}
      {/* === MODAL: NOVA CONVERSA === */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#141417]">
              <div className="flex items-center gap-2 text-zinc-100">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-base">Nova Conversa</h3>
              </div>
              <button 
                onClick={() => {
                  setIsNewChatModalOpen(false);
                  setNewChatName("");
                  setNewChatPhone("");
                  setNewChatInitialMessage("");
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={handleCreateNewChatSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Nome do Contato</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Arthur Fava"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full bg-[#161619] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-zinc-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Número do WhatsApp</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: 5511999999999"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="w-full bg-[#161619] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-zinc-600 transition-all"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Inclua o DDI (55) + DDD + número. Exemplo: 5511999999999</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Mensagem Inicial (Opcional)</label>
                <textarea 
                  placeholder="Envie uma mensagem de boas-vindas..."
                  value={newChatInitialMessage}
                  onChange={(e) => setNewChatInitialMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-[#161619] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-zinc-600 transition-all resize-none"
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
                  className="flex-1 py-2.5 bg-zinc-900 border border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingNewChat}
                  className="flex-1 py-2.5 bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all shadow"
                >
                  {isSubmittingNewChat ? "Criando..." : "Iniciar Conversa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-5 right-5 z-[100] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="bg-[#0c0c0e]/95 backdrop-blur-md border border-amber-500/20 text-zinc-200 px-4 py-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-5 duration-300 max-w-sm pointer-events-auto"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-ping" />
              <div className="text-xs font-semibold leading-relaxed">{toast.message}</div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-zinc-500 hover:text-white transition-colors text-lg font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>
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

function AnalysisPanel({ 
  result, 
  analysisId,
  onCopy, 
  copiedId 
}: { 
  result: AnalysisResponse; 
  analysisId?: string;
  onCopy: (t: string, id: string) => void; 
  copiedId: string | null; 
}) {
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
      alert("Erro ao salvar análise.");
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
    LEAD_FRIO: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    LEAD_MORNO: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    LEAD_QUENTE: "text-amber-400 border-amber-500/30 bg-amber-500/10",
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
        <SectionTitle><ArrowRight className="w-3 h-3 inline mr-1 text-zinc-300" />Próximo Passo</SectionTitle>
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
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rescuedMediaUrl, setRescuedMediaUrl] = useState<string | null>(null);
  const [isRescuing, setIsRescuing] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  const isOutbound = msg.direction === "outbound";
  const currentMediaUrl = msg.mediaUrl || rescuedMediaUrl;
  const hasMedia = !!currentMediaUrl;

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
        alert("Não foi possível carregar a mídia.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar mídia.");
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
        className={`flex w-full ${isOutbound ? "justify-end" : "justify-start"} group relative`}
        onContextMenu={(e) => onContextMenu?.(e, msg.id)}
        onClick={() => {
          if (forwardMode) onToggleSelect?.(msg.id);
        }}
      >
      <div className={`flex items-end gap-1.5 max-w-[85%] ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
        {!isOutbound && (
          <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/5 flex-shrink-0 overflow-hidden mt-1">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500 font-bold">
                {msg.text?.substring(0, 1) || "C"}
              </div>
            )}
          </div>
        )}

        <div className={`rounded px-3 py-2 relative ${isOutbound ? "bg-zinc-100 text-black rounded-tr-none shadow-sm" : "bg-zinc-900 text-zinc-300 rounded-tl-none border border-zinc-850"}`}>
          
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
                <img onClick={() => setIsLightboxOpen(true)} src={currentMediaUrl!} alt="Imagem" className="max-w-full rounded-lg mb-0.5 object-contain max-h-[200px] cursor-pointer" loading="lazy" />
                {isLightboxOpen && (
                  <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4" onClick={() => setIsLightboxOpen(false)}>
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
              <img src={currentMediaUrl!} alt="Figurinha" className="w-24 h-24 mb-0.5 object-contain" loading="lazy" />
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
                <audio controls preload="metadata" className="w-full min-w-[180px] max-w-[220px] h-8 mb-0.5">
                  <source src={currentMediaUrl!} />
                  Seu navegador não suporta áudio.
                </audio>
                {msg.text && !isMediaLabel && (
                  <div className="mt-0.5 bg-black/10 border border-black/5 rounded-md p-1 text-[11px] text-zinc-300 italic border-l-2 border-l-emerald-500/50">
                    <span className="font-semibold text-[8px] text-emerald-500/80 uppercase not-italic block mb-0.5">Transcrição IA:</span>
                    {msg.text}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleRescueMedia} disabled={isRescuing} className={`flex items-center gap-2 p-1.5 rounded-lg mb-0.5 hover:bg-black/10 transition-colors w-full text-left ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  {isRescuing ? <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-semibold">{isRescuing ? "Baixando..." : "Carregar Áudio"}</span>
                </div>
              </button>
            )
          )}

          {/* === VIDEO === */}
          {msg.type === "VIDEO" && (
            hasMedia ? (
              <video controls preload="metadata" className="max-w-full rounded-lg mb-0.5 max-h-[200px]">
                <source src={currentMediaUrl!} />
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
              <a href={currentMediaUrl!} download="documento" className={`flex items-center gap-1.5 p-1.5 rounded-lg mb-0.5 border ${isOutbound ? "bg-black/5 border-black/10 hover:bg-black/10" : "bg-white/5 border-white/10 hover:bg-white/10"} transition-colors`}>
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isOutbound ? "bg-zinc-800 text-white" : "bg-amber-500 text-black"} font-bold text-[10px] shadow`}>
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
                          isOutbound ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
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
                              isOutbound ? "bg-zinc-800 text-white border-zinc-900" : "bg-amber-500 text-black border-zinc-900"
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
                        isOutbound ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
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
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isOutbound ? "bg-zinc-800 text-white" : "bg-amber-500 text-black"} font-bold text-xs shadow`}>
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
                                : "bg-amber-500 hover:bg-amber-400 text-black"
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
            <p className="text-[14px] leading-snug whitespace-pre-wrap">{msg.text}</p>
          )}
          
          {/* === CAPTION === */}
          {msg.text && !isMediaLabel && msg.type !== "TEXT" && msg.type !== "DOCUMENT" && msg.type !== "AUDIO" && (
            <p className="text-[13px] leading-snug whitespace-pre-wrap mt-0.5 opacity-90">{msg.text}</p>
          )}

          <div className={`flex items-center gap-1 mt-0.5 ${isOutbound ? "justify-end text-black/60" : "text-zinc-500"}`}>
            <MessageTime timestamp={msg.timestamp} fallback={msg.time} />
            {isOutbound && (
              <div className="flex items-center gap-0.5">
                {msg.isEdited && <Pencil className="w-2 h-2 opacity-50" />}
                {msg.status === "SENT" && <Check className="w-3 h-3" />}
                {msg.status === "DELIVERED" && <CheckCheck className="w-3 h-3 opacity-70" />}
                {msg.status === "READ" && <CheckCheck className="w-3 h-3 text-blue-600 drop-shadow-sm" />}
                {(!msg.status || msg.status === "PENDING") && <Check className="w-3 h-3 opacity-30" />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function MessageTime({ timestamp, fallback }: { timestamp: string; fallback: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="text-[8px] font-mono uppercase tracking-widest">{fallback}</span>;
  }

  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
    return <span className="text-[8px] font-mono uppercase tracking-widest">{formatted}</span>;
  } catch {
    return <span className="text-[8px] font-mono uppercase tracking-widest">{fallback}</span>;
  }
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
