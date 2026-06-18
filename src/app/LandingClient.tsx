"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { 
  BrainCircuit, 
  ShieldAlert, 
  Zap, 
  CheckCheck, 
  ArrowRight, 
  Workflow,
  EyeOff,
  Plus,
  Play,
  Volume2,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Lock,
  Shield,
  Sliders,
  Check
} from "lucide-react";

// Premium Minimalist Card with Border Highlights
function GlowCard({ 
  children, 
  className = "", 
  glowColor = "rgba(255, 255, 255, 0.04)" 
}: { 
  children: React.ReactNode; 
  className?: string; 
  glowColor?: string;
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative p-[1px] rounded bg-zinc-900/60 border border-zinc-800/80 transition-all duration-300 hover:border-zinc-700/80 ${className}`}
    >
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(180px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 70%)`
        }}
      />
      <div className="relative z-10 w-full h-full rounded bg-[#09090b] p-6 flex flex-col justify-between">
        {children}
      </div>
    </div>
  );
}

interface ChatMsg {
  sender: "lead" | "agent";
  text: string;
  time: string;
  isAudio?: boolean;
  audioDuration?: string;
}

interface LeadSim {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  stage: string;
  temp: "HOT" | "WARM" | "COLD";
  lastMsg: string;
  time: string;
  unread: boolean;
  chatHistory: ChatMsg[];
  aiSummary: {
    summary: string;
    pains: string[];
    objectionAlert: string | null;
    suggestedReply: string;
  };
}

export default function LandingClient({ isSignedIn }: { isSignedIn: boolean }) {
  const [selectedLeadId, setSelectedLeadId] = useState("lead-1");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Pipeline Simulator State
  const [stages, setStages] = useState([
    { id: "st-1", name: "Triagem", visible: true, leads: ["Roberto Neves"] },
    { id: "st-2", name: "Qualificação", visible: true, leads: ["Ana Carolina"] },
    { id: "st-3", name: "Apresentação", visible: true, leads: [] },
    { id: "st-4", name: "Follow-up Frio", visible: false, leads: ["Marcos Dias"] }
  ]);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [selectedSimLead, setSelectedSimLead] = useState<string | null>(null);
  const [showSimLeadModal, setShowSimLeadModal] = useState(false);
  const [simulatorToast, setSimulatorToast] = useState<string | null>(null);

  // Showcase simulated data
  const LEADS_DATA: LeadSim[] = [
    {
      id: "lead-1",
      name: "Arthur Fava",
      avatar: "AF",
      avatarColor: "bg-zinc-900 border-zinc-800 text-zinc-300",
      stage: "Negociação",
      temp: "HOT",
      lastMsg: "Gostei muito do copiloto, mas o preço da licença para 15 SDRs está acima do orçamento.",
      time: "10m atrás",
      unread: true,
      chatHistory: [
        { sender: "agent", text: "Olá Arthur! Analisei seu fluxo. Podemos conectar a Evolution API hoje mesmo.", time: "11:20" },
        { sender: "lead", text: "Excelente. Quero ver como a IA atua no dia a dia ajudando a equipe comercial.", time: "11:22" },
        { sender: "agent", text: "Ela transcreve seus áudios, gera resumos estruturados e sinaliza dores em tempo real.", time: "11:24" },
        { sender: "lead", text: "Áudio enviado (0:45) - Clique para ouvir a transcrição cognitiva", time: "11:25", isAudio: true, audioDuration: "0:45" },
        { sender: "lead", text: "Gostei muito do copiloto, mas o preço da licença para 15 SDRs está acima do orçamento atual de ferramentas da empresa.", time: "11:26" }
      ],
      aiSummary: {
        summary: "Lead qualificado de nível diretivo. Possui equipe ativa de 15 SDRs e busca otimização do tempo de resposta. Apresentando objeção financeira pontual.",
        pains: [
          "Latência na qualificação inicial de leads recebidos",
          "Auditoria ineficiente de áudios de negociação no WhatsApp",
          "Escala de atendimento limitada pela equipe humana"
        ],
        objectionAlert: "Custo por licença / Orçamento anual",
        suggestedReply: "Arthur, entendo o cenário de custo. Para operações estruturadas com 15 licenças, liberamos uma condição de faturamento progressivo ou 25% de desconto no plano anual. Deseja iniciar um teste de 7 dias com 3 licenças de cortesia para validar o ROI?"
      }
    },
    {
      id: "lead-2",
      name: "Bruna Silveira",
      avatar: "BS",
      avatarColor: "bg-zinc-900 border-zinc-800 text-zinc-300",
      stage: "Qualificação",
      temp: "WARM",
      lastMsg: "Vocês têm integração direta com a Evolution API? Preciso disparar áudios gravados.",
      time: "1h atrás",
      unread: false,
      chatHistory: [
        { sender: "lead", text: "Bom dia, vi a ferramenta de vocês e gostei muito da proposta tática.", time: "09:30" },
        { sender: "agent", text: "Bom dia Bruna! Como funciona sua operação de prospecção hoje?", time: "09:32" },
        { sender: "lead", text: "Temos 5 atendentes. Usamos a Evolution API. Dá pra conectar direto sem perder históricos?", time: "09:35" },
        { sender: "lead", text: "Preciso disparar áudios gravados previamente como se fossem gravados na hora para os leads, simulando digitação, para evitar bloqueios.", time: "09:36" }
      ],
      aiSummary: {
        summary: "Gerente de Operações buscando otimização de infra. Foco total em integração nativa com Evolution API e entrega de áudios gravados simulando gravação humana.",
        pains: [
          "Instabilidade e bloqueios de chips no WhatsApp",
          "Dificuldade em padronizar áudios sem perder o tom natural",
          "Painéis descentralizados para múltiplos operadores"
        ],
        objectionAlert: "Compatibilidade de API & Taxa de Banimento",
        suggestedReply: "Bruna, sim! Conectamos diretamente na Evolution API via token em segundos. Nosso sistema simula a ação de digitação e gravação de áudio com delay variável antes de enviar o arquivo de áudio nativo (.ogg), reduzindo a taxa de banimento a quase zero."
      }
    }
  ];

  const activeLead = LEADS_DATA.find(l => l.id === selectedLeadId) || LEADS_DATA[0];

  const handleToggleStageVisibility = (stageId: string) => {
    setStages(prev => prev.map(s => {
      if (s.id === stageId) {
        const nextVisible = !s.visible;
        triggerSimulatorToast(`Etapa "${s.name}" agora está ${nextVisible ? "visível" : "oculta"} no Kanban!`);
        return { ...s, visible: nextVisible };
      }
      return s;
    }));
  };

  const handleMoveLead = (leadName: string, targetStageId: string) => {
    setStages(prev => {
      const cleaned = prev.map(s => ({
        ...s,
        leads: s.leads.filter(l => l !== leadName)
      }));
      return cleaned.map(s => {
        if (s.id === targetStageId) {
          const isTargetVisible = s.visible;
          if (!isTargetVisible) {
            triggerSimulatorToast(`Sucesso! "${leadName}" movido para a etapa OCULTA "${s.name}".`);
          } else {
            triggerSimulatorToast(`"${leadName}" movido para "${s.name}".`);
          }
          return { ...s, leads: [...s.leads, leadName] };
        }
        return s;
      });
    });
    setShowSimLeadModal(false);
  };

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim()) return;
    setStages(prev => prev.map((s, index) => {
      if (index === 0) {
        return { ...s, leads: [...s.leads, newLeadName.trim()] };
      }
      return s;
    }));
    triggerSimulatorToast(`Lead "${newLeadName.trim()}" inserido em "${stages[0].name}"!`);
    setNewLeadName("");
    setIsAddingLead(false);
  };

  const triggerSimulatorToast = (message: string) => {
    setSimulatorToast(message);
    setTimeout(() => {
      setSimulatorToast(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-200 overflow-x-hidden font-sans relative">
      {/* Subtle Structural Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[linear-gradient(to_right,#0c0c0f_1px,transparent_1px),linear-gradient(to_bottom,#0c0c0f_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_65%,transparent_100%)] opacity-35" />

      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-zinc-500/10 to-zinc-400/5 blur-[160px]" />
        <div className="absolute top-[20%] right-[5%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-zinc-600/5 to-zinc-500/2 blur-[140px]" />
      </div>

      {/* Corporate Symmetrical Header */}
      <header className="relative z-40 border-b border-zinc-900 bg-[#040406]/90 backdrop-blur-md sticky top-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <span className="font-extrabold text-xs tracking-widest text-white block uppercase">
              SALES ARCAFFO
            </span>
            <span className="text-[8px] font-mono text-zinc-500 block tracking-widest uppercase">Cognitive CRM Systems</span>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="px-3.5 py-1.5 text-[11px] font-bold rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 uppercase tracking-wider transition-all"
              >
                Painel Tático
              </Link>
              <div className="flex items-center justify-center border border-zinc-850 rounded-full p-0.5 bg-zinc-950 hover:border-zinc-700 transition-colors">
                <UserButton />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-[11px] font-semibold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
              >
                Acessar Sistema
              </Link>
              <Link
                href="#pricing-section"
                className="px-3.5 py-1.5 text-[11px] font-bold rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 uppercase tracking-wider transition-all"
              >
                Licenciamento
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Asymmetric Hero Section */}
      <section className="relative z-10 pt-20 pb-20 px-6 max-w-5xl mx-auto border-b border-zinc-900/60">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center text-left">
          
          {/* Hero Content Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-zinc-500 font-mono text-[9px] tracking-widest uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse"></span>
              Aceleração Comercial // Inteligência em Vendas
            </div>

            <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.08] text-white">
              Sua equipe vende mais <br />
              <span className="font-extrabold block bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                com Inteligência Artificial
              </span>
            </h1>

            <p className="text-zinc-500 text-xs sm:text-sm max-w-xl leading-relaxed font-normal">
              O Sales Arcaffo acompanha suas conversas comerciais do WhatsApp em tempo real. Ele detecta objeções de clientes, sugere respostas de alto impacto na hora e preenche seu CRM de forma automatizada. Menos trabalho manual, mais fechamentos.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href={isSignedIn ? "/dashboard" : "#pricing-section"}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-white text-black rounded text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                {isSignedIn ? "Acessar Painel" : "Iniciar Plano"}
              </Link>
              <a
                href="#showcase-section"
                className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                Visualizar Interface
              </a>
            </div>
          </div>

          {/* Hero Technical Terminal Column */}
          <div className="lg:col-span-5 hidden lg:block">
            <div className="border border-zinc-850/80 bg-[#070709]/80 backdrop-blur-md rounded p-4 font-mono text-[9px] text-zinc-500 space-y-4 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] rounded-full bg-zinc-500/5 blur-[40px] pointer-events-none" />
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <span>SALES_CO_PILOT: ATIVO</span>
                <span className="text-emerald-500 flex items-center gap-1.5 font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  ONLINE
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>Faturamento em Jogo:</span>
                  <span className="text-zinc-300 font-bold">R$ 156.400,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Objeções Contornadas:</span>
                  <span className="text-emerald-400">42 (84% de eficácia)</span>
                </div>
                <div className="flex justify-between">
                  <span>Leads Qualificados (IA):</span>
                  <span className="text-zinc-300">156 contatos</span>
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-3 space-y-2">
                <span className="text-zinc-650 uppercase block tracking-wider">// Eventos Recentes</span>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="truncate max-w-[120px]">Arthur Fava</span>
                  <span className="text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900/30 px-1.5 py-0.5 rounded text-[8px]">Objeção Contornada</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="truncate max-w-[120px]">Bruna Silveira</span>
                  <span className="text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[8px]">Dúvida Técnica Sanada</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Interactive Showcase Section (Workspace Simulator) */}
      <section id="showcase-section" className="relative z-10 py-20 px-6 max-w-5xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider mb-3">
            Simulador de Interface
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Workspace de Atendimento Comercial
          </h2>
          <p className="text-zinc-500 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            Interaja com as conversas na barra lateral e simule como a IA estruturada apoia os SDRs no preenchimento de CRM e respostas de alto impacto.
          </p>
        </div>

        {/* Minimalist Studio Browser Mockup */}
        <div className="rounded border border-zinc-800 bg-[#0c0c0e] p-2 shadow-2xl relative overflow-hidden">
          <div className="bg-[#070709] border border-zinc-900 rounded overflow-hidden min-h-[580px] grid grid-cols-1 lg:grid-cols-12">
            
            {/* Sidebar (Conversas Queue) */}
            <div className="lg:col-span-3 border-r border-zinc-900 bg-[#09090b] flex flex-col">
              <div className="p-3 border-b border-zinc-900 flex items-center justify-between">
                <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase">Contatos Recentes</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 block" />
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                {LEADS_DATA.map((lead) => {
                  const isActive = lead.id === selectedLeadId;
                  return (
                    <button
                      key={lead.id}
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setIsPlayingAudio(false);
                      }}
                      className={`w-full text-left p-2.5 rounded flex gap-2.5 transition-all ${
                        isActive ? "bg-zinc-900 border border-zinc-800" : "hover:bg-zinc-900/40"
                      }`}
                    >
                      <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                        {lead.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-zinc-300 truncate">{lead.name}</span>
                          <span className="text-[8px] text-zinc-650 font-mono">{lead.time}</span>
                        </div>
                        <p className="text-[9px] text-zinc-550 truncate mt-0.5">{lead.lastMsg}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Log View */}
            <div className="lg:col-span-5 flex flex-col bg-[#070709]">
              <div className="p-3 border-b border-zinc-900 bg-[#09090b] flex justify-between items-center">
                <div>
                  <span className="text-[11px] font-bold text-zinc-200 block">{activeLead.name}</span>
                  <span className="text-[8px] text-zinc-500 font-mono tracking-wider uppercase">Etapa: {activeLead.stage}</span>
                </div>
                <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  Status: {activeLead.temp}
                </span>
              </div>

              <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[340px]">
                {activeLead.chatHistory.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender === "agent" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] p-3 rounded text-[11px] leading-relaxed ${
                      msg.sender === "agent" 
                        ? "bg-zinc-100 text-black rounded-tr-none" 
                        : "bg-zinc-900 text-zinc-300 rounded-tl-none border border-zinc-850"
                    }`}>
                      {msg.isAudio ? (
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                            className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0"
                          >
                            {isPlayingAudio ? <Volume2 className="w-3.5 h-3.5 animate-bounce" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <p className="font-semibold text-zinc-400 text-[10px]">Áudio recebido ({msg.audioDuration})</p>
                            {isPlayingAudio && (
                              <p className="text-[9px] text-zinc-500 mt-0.5 italic">"Gostei da solução, mas o preço da licença..."</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                    <span className="text-[8px] text-zinc-600 mt-1 font-mono">{msg.time}</span>
                  </div>
                ))}
              </div>

              {/* Co-Pilot Output Embed */}
              <div className="p-3 border-t border-zinc-900 bg-[#09090b]">
                <div className="bg-zinc-950 border border-zinc-900 rounded p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Co-pilot Resposta Recomendada</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal italic">
                    "{activeLead.aiSummary.suggestedReply}"
                  </p>
                  <div className="flex justify-end pt-2 border-t border-zinc-900">
                    <button 
                      onClick={() => triggerSimulatorToast(`Copiado para o clipboard.`)}
                      className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded text-[8px] font-bold uppercase tracking-wider transition-all"
                    >
                      Copiar Sugestão
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cognitive Analysis Panel */}
            <div className="lg:col-span-4 border-l border-zinc-900 bg-[#09090b] p-4 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-2">Sumário de Qualificação</span>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-normal">
                    {activeLead.aiSummary.summary}
                  </p>
                </div>

                <div>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-2 font-bold">Dores Comerciais</span>
                  <div className="space-y-2">
                    {activeLead.aiSummary.pains.map((pain, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <CheckCheck className="w-3.5 h-3.5 text-zinc-650 shrink-0 mt-0.5" />
                        <span className="text-[10px] text-zinc-400 leading-normal">{pain}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {activeLead.aiSummary.objectionAlert && (
                  <div className="p-3 bg-red-950/10 border border-red-900/20 rounded">
                    <div className="flex items-center gap-2 text-red-400/90 font-mono text-[8px] uppercase tracking-wider mb-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Alerta de Objeção Ativa
                    </div>
                    <p className="text-[9.5px] text-zinc-400 leading-normal">
                      {activeLead.aiSummary.objectionAlert}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-900 pt-3 text-[8px] text-zinc-600 font-mono flex justify-between items-center uppercase tracking-widest">
                <span>Inference status: ok</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Simulator Pipeline Kanban */}
      <section className="relative z-10 py-16 px-6 max-w-5xl mx-auto border-t border-zinc-900/60 bg-[#060608]/20">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider mb-3">
            Kanban Tático
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            Minimização e Ocultamento de Colunas
          </h2>
          <p className="text-zinc-500 text-xs max-w-md mx-auto">
            Organize seu fluxo de trabalho ocultando colunas secundárias para foco total nas negociações prioritárias.
          </p>
        </div>

        <div className="bg-[#08080a] border border-zinc-900 rounded p-4 max-w-3xl mx-auto shadow-xl relative">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Filtros Ativos v2.0</span>
            <button 
              onClick={() => setIsAddingLead(!isAddingLead)}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[9px] font-bold uppercase rounded text-zinc-300 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3 h-3" /> Inserir Lead
            </button>
          </div>

          {isAddingLead && (
            <form onSubmit={handleAddLead} className="mb-4 p-3 bg-zinc-950 border border-zinc-900 rounded flex gap-2">
              <input
                type="text"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                placeholder="Nome do contato..."
                className="flex-1 bg-[#060608] border border-zinc-800 text-xs px-2.5 py-1.5 rounded text-white focus:outline-none focus:border-zinc-700"
                required
              />
              <button type="submit" className="px-3 bg-zinc-100 hover:bg-white text-black font-bold text-xs rounded transition-all">
                Salvar
              </button>
            </form>
          )}

          {/* Kanban Stage Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {stages.map((stage) => {
              if (!stage.visible) return null;
              return (
                <div key={stage.id} className="bg-[#050507] border border-zinc-900 rounded p-3 flex flex-col min-h-[160px]">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 mb-2.5">
                    <span className="text-[10px] font-bold text-zinc-300">{stage.name}</span>
                    <button 
                      onClick={() => handleToggleStageVisibility(stage.id)}
                      className="text-zinc-650 hover:text-zinc-400 transition-colors"
                      title="Ocultar coluna"
                    >
                      <EyeOff className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    {stage.leads.length === 0 ? (
                      <div className="text-[9px] text-zinc-700 text-center py-6 border border-dashed border-zinc-900 rounded">
                        Sem contatos nesta etapa
                      </div>
                    ) : (
                      stage.leads.map((leadName, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            setSelectedSimLead(leadName);
                            setShowSimLeadModal(true);
                          }}
                          className="p-2 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 rounded cursor-pointer transition-all flex items-center justify-between"
                        >
                          <span className="text-[10px] text-zinc-400">{leadName}</span>
                          <ArrowUpRight className="w-2.5 h-2.5 text-zinc-600" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hidden stage labels */}
          <div className="mt-4 border-t border-zinc-900 pt-3">
            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest block mb-2">Colunas Ocultadas</span>
            <div className="flex flex-wrap gap-2">
              {stages.filter(s => !s.visible).map(stage => (
                <div key={stage.id} className="flex items-center gap-2 bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1 text-[10px] text-zinc-500">
                  <span>{stage.name} ({stage.leads.length})</span>
                  <button 
                    onClick={() => handleToggleStageVisibility(stage.id)}
                    className="text-[9px] font-bold text-zinc-400 hover:text-white border-l border-zinc-850 pl-2 ml-1"
                  >
                    Exibir
                  </button>
                </div>
              ))}
              {stages.filter(s => !s.visible).length === 0 && (
                <span className="text-[9px] text-zinc-700">Nenhuma etapa oculta no momento.</span>
              )}
            </div>
          </div>

          {/* Toast */}
          {simulatorToast && (
            <div className="absolute bottom-3 right-3 bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 rounded text-[10px] font-mono shadow-xl flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-zinc-400"></span>
              {simulatorToast}
            </div>
          )}

          {/* Modal */}
          {showSimLeadModal && selectedSimLead && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
              <div className="bg-[#09090b] border border-zinc-800 rounded p-4 max-w-xs w-full">
                <h4 className="text-xs font-bold text-zinc-300 mb-2">Mover contato: {selectedSimLead}</h4>
                <div className="space-y-1">
                  {stages.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handleMoveLead(selectedSimLead, st.id)}
                      className="w-full py-1.5 hover:bg-zinc-900 text-left px-2 rounded text-[10px] text-zinc-400 flex items-center justify-between border border-transparent hover:border-zinc-850"
                    >
                      <span>{st.name}</span>
                      {!st.visible && (
                        <span className="text-[7px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 rounded">
                          Oculta
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setShowSimLeadModal(false)}
                  className="mt-4 w-full py-1.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-400 border border-zinc-800 text-[10px] font-bold rounded"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bento Grid: Core Technical Assets */}
      <section className="relative z-10 py-20 px-6 max-w-5xl mx-auto">
        <div className="absolute top-[30%] left-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-zinc-600/5 to-zinc-500/2 blur-[160px] pointer-events-none" />
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider mb-3">
            Inteligência e Funções
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Mais Poder para sua Operação de Vendas
          </h2>
          <p className="text-zinc-500 text-xs sm:text-sm max-w-md mx-auto">
            Recursos comerciais estruturados para maximizar a conversão da sua equipe de atendimento e organizar seus dados.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Card 1: Transcrição e Análise (md:col-span-8) */}
          <GlowCard className="md:col-span-8 flex flex-col justify-between min-h-[220px]">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-400">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">Transcrição e Análise Comercial de Áudios</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                Economize o tempo de escuta do time. A IA transcreve mensagens de voz do cliente instantaneamente, detecta dores, orçamento e intenção de compra, estruturando tudo em um sumário comercial legível e acionável.
              </p>
            </div>
          </GlowCard>

          {/* Card 2: Objeções (md:col-span-4) */}
          <GlowCard className="md:col-span-4 flex flex-col justify-between min-h-[220px]">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center text-amber-500">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">Objeções em Tempo Real</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                Identifique na hora quando o cliente trouxer barreiras de preço ou concorrência. O sistema emite alertas visuais vermelhos e mune seu vendedor com o melhor argumento de contorno.
              </p>
            </div>
          </GlowCard>

          {/* Card 3: Copiloto (md:col-span-4) */}
          <GlowCard className="md:col-span-4 flex flex-col justify-between min-h-[220px]">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-400">
                <Sliders className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">Sugestão de Respostas (Copiloto)</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                Com base no contexto completo da negociação, a IA gera roteiros de respostas de alta conversão. O vendedor copia a sugestão e envia no WhatsApp com apenas um clique.
              </p>
            </div>
          </GlowCard>

          {/* Card 4: Kanban Inteligente (md:col-span-8) */}
          <GlowCard className="md:col-span-8 flex flex-col justify-between min-h-[220px]">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-400">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">Qualificação e Funil Automatizados</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                Esqueça o preenchimento manual de CRM. O Sales Arcaffo analisa as interações no WhatsApp e atualiza a temperatura do lead (Frio/Morno/Quente) e as etapas do Kanban comercial de forma totalmente autônoma.
              </p>
            </div>
          </GlowCard>

        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing-section" className="relative z-10 py-20 px-6 max-w-5xl mx-auto border-t border-zinc-900/60 scroll-mt-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider mb-3">
            Licenciamento Comercial
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Modelos de Ativação do Sistema
          </h2>
          <p className="text-zinc-500 text-xs sm:text-sm max-w-md mx-auto">
            Selecione o plano ideal para a sua estrutura de atendimento comercial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          
          {/* Monthly Licence */}
          <div className="border border-zinc-850 rounded bg-[#070709] p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider">Licença Mensal</h3>
                  <p className="text-[9px] text-zinc-500">Expansão flexível de SDRs</p>
                </div>
                <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400">Mensal</span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-zinc-500 text-xs font-semibold">R$</span>
                  <span className="text-white text-3xl font-extrabold tracking-tight">109,90</span>
                  <span className="text-zinc-500 text-[10px] font-medium">/ mês</span>
                </div>
                <p className="text-[8px] text-zinc-600 mt-1">Cobrança recorrente via cartão de crédito</p>
              </div>

              <ul className="space-y-3.5 border-t border-zinc-900 pt-4">
                {[
                  "Copiloto cognitivo de IA ativo",
                  "Kanban com colunas ocultáveis",
                  "Integração Evolution API inclusa",
                  "Criptografia de credenciais",
                  "Suporte padrão via plataforma"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-[10px] text-zinc-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href={isSignedIn ? "/dashboard" : "/checkout?plan=mensal"}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded text-[10px] font-bold text-center block uppercase tracking-wider transition-all"
            >
              {isSignedIn ? "Ir para o Painel" : "Iniciar Plano Mensal"}
            </Link>
          </div>

          {/* Annual Licence */}
          <div className="border border-zinc-700 rounded bg-[#09090c] p-6 flex flex-col justify-between space-y-6 relative">
            <div className="absolute top-0 right-6 -translate-y-1/2">
              <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-zinc-600 bg-zinc-900 text-white uppercase tracking-wider">
                [ Recomendado // 20% OFF ]
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider">Licença Anual</h3>
                  <p className="text-[9px] text-zinc-500">Custo-benefício tático estruturado</p>
                </div>
                <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400">Anual</span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-zinc-500 text-xs font-semibold">R$</span>
                  <span className="text-white text-3xl font-extrabold tracking-tight">87,92</span>
                  <span className="text-zinc-500 text-[10px] font-medium">/ mês</span>
                </div>
                <p className="text-[8px] text-zinc-500 mt-1">
                  R$ 1.055,04/ano à vista no Pix ou em 12x de R$ 109,90 no cartão
                </p>
              </div>

              <ul className="space-y-3.5 border-t border-zinc-900 pt-4">
                {[
                  "Todos os recursos do plano mensal",
                  "Acesso prioritário a novas ferramentas",
                  "Mentoria de setup operacional (1 call)",
                  "Suporte premium direto no WhatsApp"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                    <span className="text-[10px] text-zinc-300 font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href={isSignedIn ? "/dashboard" : "/checkout?plan=anual"}
              className="w-full py-2.5 bg-zinc-100 hover:bg-white text-black rounded text-[10px] font-bold text-center block uppercase tracking-wider transition-all"
            >
              {isSignedIn ? "Ir para o Painel" : "Iniciar Plano Anual"}
            </Link>
          </div>

        </div>
      </section>

      {/* Symmetrical Footer */}
      <footer className="relative z-10 border-t border-zinc-900 py-12 text-center text-[10px] text-zinc-600 bg-[#040406]">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-zinc-500 font-bold font-mono tracking-widest">
            <BrainCircuit className="w-4 h-4 text-zinc-500" />
            <span>SALES ARCAFFO</span>
          </div>
          <p>© 2026 Sales Arcaffo. Todos os direitos reservados. Sistemas de inteligência comercial.</p>
          <div className="flex gap-4 font-mono text-[8px] text-zinc-700">
            <span>SYS_VERSION: 2.2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
