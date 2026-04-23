"use client";

import { useEffect, useState } from "react";
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
  Phone,
  Play,
  Save,
  Search,
  Send,
  ShieldAlert,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  getConversations,
  sendConversationMessage,
  updateConversationStage,
  type ConversationAnalysisData,
  type ConversationData,
} from "@/actions/crm";
import type { AnalysisResponse } from "@/lib/ai/prompts";

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

  const selectConversation = (conversationId: string, source: ConversationData[]) => {
    const conversation = source.find((item) => item.id === conversationId);
    setSelectedConvo(conversationId);
    setDraftStage(conversation?.stageKey || "PRIMEIRO_CONTATO");
    setAnalysisResult(conversation?.latestAnalysis || null);
    setDraftMessage("");
  };

  useEffect(() => {
    let alive = true;

    getConversations()
      .then((result) => {
        if (!alive) {
          return;
        }

        setConversations(result);
        if (result[0]) {
          selectConversation(result[0].id, result);
        }
      })
      .catch((error) => {
        console.error("Failed to load conversations:", error);
      });

    return () => {
      alive = false;
    };
  }, []);

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

  const activeConvo = conversations.find((conversation) => conversation.id === selectedConvo) || null;

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

  const handleSendMessage = async () => {
    if (!activeConvo || !draftMessage.trim()) {
      return;
    }

    setIsSending(true);
    try {
      const newMessage = await sendConversationMessage(activeConvo.id, draftMessage);

      setConversations((current) => current.map((conversation) => (
        conversation.id === activeConvo.id
          ? {
              ...conversation,
              msg: newMessage.text,
              time: newMessage.time,
              messageCount: conversation.messageCount + 1,
              messages: [...conversation.messages, newMessage],
            }
          : conversation
      )));

      setDraftMessage("");
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setIsSending(false);
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
      <section className="w-80 border-r border-border/60 bg-[#0a0a0c] flex flex-col shrink-0">
        <div className="p-4 border-b border-border/40">
          <h2 className="text-base font-semibold tracking-tight mb-3 text-zinc-100">Inbox</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar conversas..."
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => selectConversation(convo.id, conversations)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-all duration-200 group ${
                selectedConvo === convo.id ? "bg-white/[0.06] border-l-2 border-l-zinc-400" : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0 border border-zinc-700/50">
                  {convo.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-medium text-sm text-zinc-200 truncate">{convo.name}</h3>
                    <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{convo.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[convo.status]}`} />
                    <span className="text-[11px] text-zinc-500 font-medium">{convo.stage}</span>
                    <span className="text-[11px] text-zinc-600">• {convo.company}</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{convo.msg}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex-1 flex flex-col bg-background relative min-w-0">
        {activeConvo ? (
          <>
            <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 bg-[#0c0c0e]/80 backdrop-blur-sm shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50 shrink-0">
                  <span className="text-xs font-semibold text-zinc-300">{activeConvo.initials}</span>
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
              <div className="flex gap-3 text-zinc-500 shrink-0">
                <Phone className="w-4 h-4" />
                <MoreVertical className="w-4 h-4" />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {activeConvo.messages.length > 0 ? (
                activeConvo.messages.map((message) => (
                  message.type === "AUDIO" ? (
                    <AudioMessage key={message.id} text={message.text} time={message.time} type={message.direction} />
                  ) : (
                    <MessageBubble key={message.id} type={message.direction} text={message.text} time={message.time} />
                  )
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600">
                  <p className="text-sm">Sem mensagens nesta conversa</p>
                </div>
              )}
            </div>

            <footer className="p-3 bg-[#0a0a0c] border-t border-border/40 shrink-0 space-y-2">
              {!activeConvo.canReply && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Conecte o WhatsApp Business para enviar mensagens de saída.
                </p>
              )}
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2 focus-within:ring-1 focus-within:ring-zinc-600">
                <Paperclip className="w-4 h-4 text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors" />
                <input
                  type="text"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm py-1.5 placeholder:text-zinc-600"
                />
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={isSending || !draftMessage.trim() || !activeConvo.canReply}
                  className="p-2 bg-white/10 rounded-lg text-zinc-300 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-3">
            <MessageSquare className="w-10 h-10 text-zinc-800" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        )}
      </section>

      <section className="w-[420px] bg-[#0a0a0c] border-l border-white/[0.06] flex flex-col shrink-0 z-20">
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-0.5">
            <BrainCircuit className="w-4 h-4 text-zinc-400" />
            <h2 className="font-semibold text-sm tracking-tight text-zinc-200">Sales Noir</h2>
          </div>
          <p className="text-[11px] text-zinc-600">Operação tática da conversa</p>
        </div>

        {activeConvo ? (
          <div className="p-5 flex-1 overflow-y-auto space-y-5">
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
                <SectionTitle>Anotações do Lead</SectionTitle>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-sm text-zinc-400 min-h-24">
                  {activeConvo.notes || "Sem anotações registradas."}
                </div>
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
                  {analysisResult ? <AnalysisPanel result={analysisResult} onCopy={handleCopy} copiedId={copiedId} /> : null}
                </>
              )}
            </div>
          </div>
        ) : null}

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
      </section>
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

function AnalysisPanel({ result, onCopy, copiedId }: { result: AnalysisResponse; onCopy: (t: string, id: string) => void; copiedId: string | null }) {
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
    <div className="space-y-5">
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
        <SectionTitle>Resumo Executivo</SectionTitle>
        <p className="text-sm text-zinc-300 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/5">{result.summary}</p>
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
        <p className="text-[13px] text-zinc-200 font-medium leading-relaxed">{result.nextConcreteStep}</p>
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

function MessageBubble({ type, text, time }: { type: "inbound" | "outbound"; text: string; time: string }) {
  const isOut = type === "outbound";

  return (
    <div className={`flex flex-col gap-1 ${isOut ? "items-end" : "items-start"}`}>
      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
        isOut
          ? "bg-zinc-800/80 text-zinc-200 rounded-tr-sm border border-white/[0.06]"
          : "bg-[#111113] text-zinc-300 rounded-tl-sm border border-white/[0.06]"
      }`}>
        {text}
      </div>
      <span className="text-[10px] text-zinc-600 px-1">{time}</span>
    </div>
  );
}

function AudioMessage({ type, text, time }: { type: "inbound" | "outbound"; text: string; time: string }) {
  const isOut = type === "outbound";

  return (
    <div className={`flex flex-col gap-1.5 ${isOut ? "items-end" : "items-start"} max-w-[75%]`}>
      <div className="bg-[#111113] border border-white/[0.06] text-foreground px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-3 w-64">
        <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10">
          <Play className="w-3.5 h-3.5 fill-current text-zinc-300" />
        </button>
        <div className="flex-1">
          <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-zinc-500 rounded-full" />
          </div>
        </div>
        <span className="text-[11px] text-zinc-500">0:42</span>
      </div>
      <div className="flex items-start gap-2 ml-1 text-[11px] text-zinc-500/80 bg-white/[0.02] p-2 rounded-md border border-white/5">
        <Mic className="w-3 h-3 shrink-0 mt-0.5 text-zinc-600" />
        <p className="italic leading-relaxed">&quot;{text}&quot;</p>
      </div>
      <span className="text-[10px] text-zinc-600 px-1">{time}</span>
    </div>
  );
}
