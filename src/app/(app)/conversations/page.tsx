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
  type ConversationAnalysisData,
  type ConversationData,
  type ConversationMessage,
} from "@/actions/crm";
import type { AnalysisResponse } from "@/lib/ai/prompts";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const STATUS_COLORS = {
  hot: "bg-amber-500",
  warm: "bg-yellow-400",
  cold: "bg-blue-500",
};

const STAGE_OPTIONS = [
  "PRIMEIRO_CONTATO",
  "QUALIFICACAO",
  "APRESENTACAO_PROPOSTA",
  "NEGOCIACAO",
  "OBJECAO",
  "FOLLOW_UP",
  "FECHAMENTO",
  "REATIVACAO",
] as const;

const STAGE_LABELS: Record<string, string> = {
  PRIMEIRO_CONTATO: "Primeiro Contato",
  QUALIFICACAO: "Qualificação",
  APRESENTACAO_PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  OBJECAO: "Objeção",
  FOLLOW_UP: "Follow-up",
  FECHAMENTO: "Fechamento",
  REATIVACAO: "Reativação",
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
  const [draftMessage, setDraftMessage] = useState("");
  const [draftStage, setDraftStage] = useState("PRIMEIRO_CONTATO");
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const selectConversation = (conversationId: string, source: ConversationData[]) => {
    const conversation = source.find((item) => item.id === conversationId);
    setSelectedConvo(conversationId);
    setDraftStage(conversation?.stageKey || "PRIMEIRO_CONTATO");
    setNotesDraft(conversation?.notes || "");
    setAnalysisResult(conversation?.latestAnalysis || null);
    setDraftMessage("");
  };

  const handleEmojiClick = (emojiData: any) => {
    setDraftMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
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
    const profile = await getWhatsAppProfile();
    setMyProfile(profile);
  };

  useEffect(() => {
    let alive = true;
    let timeoutId: NodeJS.Timeout;

    async function refreshData() {
      if (!alive) return;
      try {
        const result = await getConversations();
        if (!alive) return;

        setConversations((prev) => {
          // Se for a primeira carga ou se a lista mudou, atualizamos
          if (JSON.stringify(prev) !== JSON.stringify(result)) {
            return result;
          }
          return prev;
        });

        // Se nada estiver selecionado, selecionamos a primeira
        if (result.length > 0 && !selectedConvo) {
          selectConversation(result[0].id, result);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        if (alive) {
          timeoutId = setTimeout(refreshData, 5000);
        }
      }
    }

    // Carga inicial
    refreshData();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
    };
  }, [selectedConvo]); // Dependemos de selectedConvo para a lógica de seleção inicial

  const filteredConversations = conversations.filter((conversation) => {
    const haystack = [
      conversation.name,
      conversation.company,
      conversation.phone,
      conversation.origin,
      conversation.msg,
      conversation.stage,
      conversation.notes || "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm.toLowerCase());
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
              stage: STAGE_LABELS[draftStage] || draftStage,
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
        className={`border-r border-border/60 bg-[#0a0a0c] flex flex-col shrink-0 transition-all duration-300 relative ${isSidebarCollapsed ? "w-16" : "w-80"}`}
      >
        <div className={`p-4 border-b border-border/40 ${isSidebarCollapsed ? "flex flex-col items-center" : ""}`}>
          <div className="flex items-center justify-between mb-3 w-full">
            {!isSidebarCollapsed && <h2 className="text-base font-semibold tracking-tight text-zinc-100">Inbox</h2>}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title={isSidebarCollapsed ? "Expandir" : "Recolher"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
          
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2">
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
                onClick={openMyProfile}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="Meu Perfil"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
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
          {filteredConversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => selectConversation(convo.id, conversations)}
              className={`cursor-pointer transition-all duration-200 group relative ${
                isSidebarCollapsed ? "p-3 flex justify-center" : "p-4 border-b border-white/5"
              } ${
                selectedConvo === convo.id ? "bg-white/[0.06] border-l-2 border-l-zinc-400" : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
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
                  {convo.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-[#0a0a0c] flex items-center justify-center">
                      <span className="text-[8px] font-bold text-black">{convo.unread}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0 border border-zinc-700/50 overflow-hidden">
                    {convo.avatarUrl ? (
                      <img src={convo.avatarUrl} alt={convo.name} className="w-full h-full object-cover" />
                    ) : (
                      convo.initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="font-medium text-sm text-zinc-200 truncate">{convo.name}</h3>
                      <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{convo.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[convo.status]}`} />
                      <span className="text-[11px] text-zinc-500 font-medium">{convo.stage}</span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{convo.msg}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <main className="flex-1 flex flex-col bg-background relative min-w-0">
        {activeConvo ? (
          <>
            <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 bg-[#0c0c0e]/80 backdrop-blur-sm shrink-0 z-10">
              <div 
                className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setIsContactProfileModalOpen(true)}
              >
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50 shrink-0 overflow-hidden">
                  {activeConvo.avatarUrl ? (
                    <img src={activeConvo.avatarUrl} alt={activeConvo.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-zinc-300">{activeConvo.initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-sm truncate">{activeConvo.name}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                      {activeConvo.stage}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{activeConvo.phone} • {activeConvo.company}</p>
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

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {activeConvo.messages.length > 0 ? (
                activeConvo.messages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    msg={message} 
                    avatarUrl={activeConvo.avatarUrl}
                    onContextMenu={(e, id) => {
                      e.preventDefault();
                      setContextMenu({ msgId: id, x: e.pageX, y: e.pageY });
                    }}
                    onReactionClick={(id) => setReactionPicker(id)}
                  />
                ))
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
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 bg-[#0a0a0c]">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center mb-4 border border-white/5">
              <MessageSquare className="w-8 h-8 text-zinc-700" />
            </div>
            <h3 className="text-zinc-400 font-medium mb-1">Nexus Copilot</h3>
            <p className="text-sm">Selecione uma conversa para começar</p>
          </div>
        )}
      </main>

      <section 
        className={`bg-[#0a0a0c] border-l border-white/[0.06] flex flex-col shrink-0 z-20 transition-all duration-300 relative ${isAnalysisCollapsed ? "w-12" : "w-[420px]"}`}
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
                <MetaCard label="Origem" value={activeConvo.origin} />
                <MetaCard label="Mensagens" value={String(activeConvo.messageCount)} />
                <MetaCard label="Telefone" value={activeConvo.phone} />
                <MetaCard label="Temperatura" value={activeConvo.status.toUpperCase()} />
              </div>

              <div className="space-y-2">
                <SectionTitle>Estágio Comercial</SectionTitle>
                <div className="flex gap-2">
                  <select
                    value={draftStage}
                    onChange={(event) => setDraftStage(event.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  >
                    {STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void handleSaveStage()}
                    disabled={isSavingStage || draftStage === activeConvo.stageKey}
                    className="px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingStage ? "Salvando" : "Salvar"}
                  </button>
                </div>
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
          <div className="p-4 border-t border-white/[0.06]">
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
              {myProfile ? (
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
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-10 h-10 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
                  <p className="text-sm text-zinc-500">Carregando dados do WhatsApp...</p>
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
                <h2 className="text-xl font-bold text-white mb-1">{activeConvo.name}</h2>
                <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{activeConvo.phone}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <MetaCard label="Empresa" value={activeConvo.company} />
                <MetaCard label="Origem" value={activeConvo.origin} />
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

  const stageLabels: Record<string, string> = {
    PRIMEIRO_CONTATO: "1º Contato",
    QUALIFICACAO: "Qualificação",
    APRESENTACAO_PROPOSTA: "Proposta",
    NEGOCIACAO: "Negociação",
    OBJECAO: "Objeção",
    FOLLOW_UP: "Follow-up",
    FECHAMENTO: "Fechamento",
    REATIVACAO: "Reativação",
  };

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
          {stageLabels[result.stage] || result.stage}
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
  avatarUrl 
}: { 
  msg: ConversationMessage; 
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  onReactionClick?: (id: string) => void;
  avatarUrl?: string | null;
}) {
  const isOutbound = msg.direction === "outbound";
  const hasMedia = !!msg.mediaUrl;
  
  // Labels that should be hidden when media is present
  const mediaLabels = ["Mensagem de áudio", "Imagem enviada", "Documento enviado", "Figurinha", "Vídeo enviado", "Imagem", "Vídeo", "Documento"];
  const isMediaLabel = mediaLabels.includes(msg.text);
  
  return (
    <div 
      id={msg.id}
      className={`flex w-full ${isOutbound ? "justify-end" : "justify-start"} group relative`}
      onContextMenu={(e) => isOutbound && onContextMenu?.(e, msg.id)}
    >
      <div className={`flex items-end gap-2 max-w-[85%] ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
        {!isOutbound && (
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                {msg.text?.substring(0, 1) || "C"}
              </div>
            )}
          </div>
        )}

        <div className={`rounded-2xl px-4 py-3 relative ${isOutbound ? "bg-white text-black rounded-br-sm shadow-sm" : "bg-[#18181b] text-zinc-200 rounded-bl-sm border border-white/5"}`}>
          
          {/* Reaction Button (appears on hover) */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onReactionClick?.(msg.id);
            }}
            className={`absolute top-0 -translate-y-1/2 p-1.5 rounded-full bg-zinc-900 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-zinc-800 ${isOutbound ? "left-0 -translate-x-full" : "right-0 translate-x-full"}`}
          >
            <Smile className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* === IMAGE === */}
          {msg.type === "IMAGE" && (
            hasMedia ? (
              <img src={msg.mediaUrl!} alt="Imagem" className="max-w-full rounded-lg mb-2 object-contain max-h-[300px]" loading="lazy" />
            ) : (
              <div className={`flex items-center gap-2 p-3 rounded-lg mb-2 ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs opacity-60">📷 Imagem recebida</span>
              </div>
            )
          )}
          
          {/* === STICKER === */}
          {msg.type === "STICKER" && (
            hasMedia ? (
              <img src={msg.mediaUrl!} alt="Figurinha" className="w-32 h-32 mb-2 object-contain" loading="lazy" />
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏷️</span>
                <span className="text-xs opacity-60">Figurinha</span>
              </div>
            )
          )}

          {/* === AUDIO === */}
          {msg.type === "AUDIO" && (
            hasMedia ? (
              <div className="mb-2">
                <audio controls preload="metadata" className="w-full min-w-[220px] max-w-[300px] h-10 mb-2">
                  <source src={msg.mediaUrl!} />
                  Seu navegador não suporta áudio.
                </audio>
                {msg.text && !isMediaLabel && (
                  <div className="mt-2 bg-black/10 border border-black/5 rounded-md p-2 text-[13px] text-zinc-300 italic border-l-2 border-l-emerald-500/50">
                    <span className="font-semibold text-[10px] text-emerald-500/80 uppercase not-italic block mb-1">Transcrição IA:</span>
                    {msg.text}
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs opacity-60">🎤 Áudio recebido</span>
                  {msg.text && !isMediaLabel && (
                    <span className="text-xs italic text-zinc-400 mt-1">"{msg.text}"</span>
                  )}
                </div>
              </div>
            )
          )}

          {/* === VIDEO === */}
          {msg.type === "VIDEO" && (
            hasMedia ? (
              <video controls preload="metadata" className="max-w-full rounded-lg mb-2 max-h-[300px]">
                <source src={msg.mediaUrl!} />
              </video>
            ) : (
              <div className={`flex items-center gap-2 p-3 rounded-lg mb-2 ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className="w-8 h-8 rounded bg-violet-500/20 flex items-center justify-center">
                  <Play className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-xs opacity-60">🎬 Vídeo recebido</span>
              </div>
            )
          )}

          {/* === DOCUMENT === */}
          {msg.type === "DOCUMENT" && (
            hasMedia ? (
              <a href={msg.mediaUrl!} download="documento" className={`flex items-center gap-3 p-3 rounded-lg mb-2 border ${isOutbound ? "bg-black/5 border-black/10 hover:bg-black/10" : "bg-white/5 border-white/10 hover:bg-white/10"} transition-colors`}>
                <div className={`p-2 rounded-md ${isOutbound ? "bg-white" : "bg-[#27272a]"}`}>
                  <Paperclip className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{isMediaLabel ? "Documento Anexado" : msg.text}</p>
                  <p className={`text-[10px] ${isOutbound ? "text-black/60" : "text-zinc-500"}`}>Clique para baixar</p>
                </div>
              </a>
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${isOutbound ? "bg-black/5" : "bg-white/5"}`}>
                <div className={`p-2 rounded-md ${isOutbound ? "bg-white" : "bg-[#27272a]"}`}>
                  <Paperclip className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{isMediaLabel ? "Documento" : msg.text}</p>
                  <p className={`text-[10px] ${isOutbound ? "text-black/60" : "text-zinc-500"}`}>📎 Documento recebido</p>
                </div>
              </div>
            )
          )}

          {/* === TEXT === */}
          {msg.text && !(isMediaLabel && (msg.type !== "TEXT")) && msg.type === "TEXT" && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
          )}
          
          {/* === CAPTION === */}
          {msg.text && !isMediaLabel && msg.type !== "TEXT" && msg.type !== "DOCUMENT" && msg.type !== "AUDIO" && (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap mt-1 opacity-90">{msg.text}</p>
          )}

          <div className={`flex items-center gap-1.5 mt-2 ${isOutbound ? "justify-end text-black/60" : "text-zinc-500"}`}>
            <span className="text-[10px] font-medium tracking-wide uppercase">{msg.time}</span>
            {isOutbound && (
              <div className="flex items-center gap-0.5">
                {msg.isEdited && <Pencil className="w-2.5 h-2.5 opacity-50" />}
                <CheckCheck className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
