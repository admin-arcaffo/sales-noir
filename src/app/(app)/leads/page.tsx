"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowUpRight, Filter, MessageSquare, Phone, Save, Search, Tag, Users, Edit, X, Wand2, Mail, Building, LayoutTemplate, Briefcase, TrendingUp, AlertTriangle, Settings, Plus, Trash2 } from "lucide-react";
import { 
  getLeads, 
  updateConversationStage, 
  updateConversationTemperature,
  getPipelineStages, 
  getProducts, 
  updateContactProfile, 
  suggestChallengesFromAI,
  type LeadData, 
  type PipelineStageData, 
  type ProductData,
  getLeadOrigins,
  createProduct,
  updateProduct,
  deleteProduct,
  createLeadOrigin,
  updateLeadOrigin,
  deleteLeadOrigin,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages
} from "@/actions/crm";

const STAGES_REQUIRING_PRODUCT = ["APRESENTACAO_PROPOSTA", "NEGOCIACAO", "OBJECAO", "FOLLOW_UP", "FECHAMENTO"];

const tempStyles: Record<string, string> = {
  HOT: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  WARM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  COLD: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

const KANBAN_STAGES = [
  { id: "PRIMEIRO_CONTATO", title: "1º Contato", color: "bg-zinc-500" },
  { id: "QUALIFICACAO", title: "Qualificação", color: "bg-blue-500" },
  { id: "APRESENTACAO_PROPOSTA", title: "Proposta", color: "bg-indigo-500" },
  { id: "NEGOCIACAO", title: "Negociação", color: "bg-amber-500" },
  { id: "OBJECAO", title: "Objeção", color: "bg-red-500" },
  { id: "FOLLOW_UP", title: "Follow-up", color: "bg-purple-500" },
  { id: "FECHAMENTO", title: "Fechamento", color: "bg-emerald-500" },
  { id: "REATIVACAO", title: "Reativação", color: "bg-zinc-500" },
];

const STAGE_COLORS = [
  { class: "bg-zinc-500", name: "Cinza" },
  { class: "bg-blue-500", name: "Azul" },
  { class: "bg-indigo-500", name: "Índigo" },
  { class: "bg-amber-500", name: "Laranja" },
  { class: "bg-red-500", name: "Vermelho" },
  { class: "bg-purple-500", name: "Roxo" },
  { class: "bg-emerald-500", name: "Verde" },
  { class: "bg-pink-500", name: "Rosa" },
  { class: "bg-cyan-500", name: "Ciano" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("ALL");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [isSuggestingChallenges, setIsSuggestingChallenges] = useState(false);
  // Product-required gate modal
  const [pendingMove, setPendingMove] = useState<{ leadId: string; newStage: string; newStageLabel: string } | null>(null);
  const [pendingProductId, setPendingProductId] = useState("");

  // Configuration Modal States
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"products" | "origins" | "stages">("products");
  const [leadOrigins, setLeadOrigins] = useState<{ id: string; name: string }[]>([]);
  
  // Stages configuration states
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("bg-zinc-500");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingStageColor, setEditingStageColor] = useState("bg-zinc-500");
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [migrationStageName, setMigrationStageName] = useState("");
  
  // Create state
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newOriginName, setNewOriginName] = useState("");

  // Edit state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductPrice, setEditingProductPrice] = useState("");
  const [editingProductDesc, setEditingProductDesc] = useState("");

  const [editingOriginId, setEditingOriginId] = useState<string | null>(null);
  const [editingOriginName, setEditingOriginName] = useState("");

  const refreshData = () => {
    Promise.all([
      getLeads(),
      getPipelineStages(),
      getProducts(),
      getLeadOrigins()
    ])
      .then(([leadsResult, stagesResult, productsResult, originsResult]) => {
        setLeads(leadsResult);
        setPipelineStages(stagesResult);
        setProducts(productsResult);
        setLeadOrigins(originsResult);
      })
      .catch((error) => console.error("Failed to load data:", error));
  };

  useEffect(() => {
    refreshData();
  }, []);

  const activeStages = pipelineStages.length > 0 
    ? pipelineStages.map(s => ({ id: s.name, title: s.name, color: s.color }))
    : KANBAN_STAGES;

  const filteredLeads = leads.filter((lead) => {
    const haystack = [lead.name, lead.company, lead.phone, lead.origin, lead.notes || ""].join(" ").toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesTemperature = temperatureFilter === "ALL" || lead.temperature === temperatureFilter;
    return matchesSearch && matchesTemperature;
  });

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stageKey === newStage) return;

    const stageConfig = activeStages.find(s => s.id === newStage);
    const newStageLabel = stageConfig?.title || newStage;

    // Gate: require product for stages after Qualificação
    if (STAGES_REQUIRING_PRODUCT.includes(newStage) && !lead.productId) {
      setPendingMove({ leadId, newStage, newStageLabel });
      setPendingProductId("");
      return;
    }

    await executeStageMove(leadId, newStage, newStageLabel);
  };

  const executeStageMove = async (leadId: string, newStage: string, newStageLabel: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    setLeads(current => current.map(l => 
      l.id === leadId ? { ...l, stageKey: newStage, stage: newStageLabel } : l
    ));

    if (lead.conversationId) {
      try {
        await updateConversationStage(lead.conversationId, newStage);
      } catch (error) {
        console.error("Failed to update stage:", error);
      }
    }
  };

  const handleConfirmPendingMove = async () => {
    if (!pendingMove || !pendingProductId) return;
    // Save product to lead
    await updateContactProfile(pendingMove.leadId, { productId: pendingProductId });
    // Update local state
    setLeads(current => current.map(l => 
      l.id === pendingMove.leadId ? { ...l, productId: pendingProductId } : l
    ));
    // Execute the stage move
    await executeStageMove(pendingMove.leadId, pendingMove.newStage, pendingMove.newStageLabel);
    setPendingMove(null);
    setPendingProductId("");
  };

  const handleSuggestChallenges = async (leadId: string) => {
    setIsSuggestingChallenges(true);
    try {
      const suggestion = await suggestChallengesFromAI(leadId);
      if (suggestion && selectedLead) {
        setSelectedLead({ ...selectedLead, mainChallenges: suggestion });
      }
    } catch (error) {
      console.error("Failed to suggest challenges", error);
    } finally {
      setIsSuggestingChallenges(false);
    }
  };

  const handleSaveLead = async () => {
    if (!selectedLead) return;
    setIsEditingLead(true);
    try {
      await updateContactProfile(selectedLead.id, {
        name: selectedLead.name,
        email: selectedLead.email || undefined,
        company: selectedLead.company,
        monthlyRevenue: selectedLead.monthlyRevenue || undefined,
        mainChallenges: selectedLead.mainChallenges || undefined,
        productId: selectedLead.productId || undefined,
        notes: selectedLead.notes || undefined,
        origin: selectedLead.origin || undefined,
      });
      // Update local state
      setLeads(current => current.map(l => l.id === selectedLead.id ? selectedLead : l));
      setSelectedLead(null);
    } catch (error) {
      console.error("Failed to save lead:", error);
    } finally {
      setIsEditingLead(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="p-6 md:p-8 shrink-0 flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-zinc-900 bg-[#09090b]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-3">
            Pipeline Comercial
            <span className="text-[10px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
              {filteredLeads.length} Leads
            </span>
          </h1>
          <p className="label-mono mt-2">Gerencie a jornada dos seus clientes arrastando os cards pelo funil.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar leads..."
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {["ALL", "HOT", "WARM", "COLD"].map((value) => (
              <button
                key={value}
                onClick={() => setTemperatureFilter(value)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                  temperatureFilter === value
                    ? "bg-zinc-100 text-black border-zinc-100"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {value === "ALL" ? "Todos" : value}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setIsConfigModalOpen(true);
            }}
            className="p-2 py-2 px-3 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
            title="Configurações da Pipeline"
          >
            <Settings className="w-4 h-4" />
            <span className="text-xs font-semibold sm:hidden md:inline">Configurações</span>
          </button>
        </div>
      </header>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-[#040406]">
        <div className="flex h-full gap-4 pb-4 min-w-max">
          {activeStages.map((column) => {
            const columnLeads = filteredLeads.filter(l => l.stageKey === column.id);
            
            return (
              <div 
                key={column.id} 
                className="flex flex-col w-[320px] shrink-0 h-full max-h-full bg-[#050507] border border-zinc-900 rounded p-3"
                onDragOver={handleDragOver}
                onDrop={(e) => void handleDrop(e, column.id)}
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${column.color}`} />
                    <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">{column.title}</h3>
                  </div>
                  <span className="font-mono text-[9px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850">
                    {columnLeads.length}
                  </span>
                </div>

                <div className={`flex-1 overflow-y-auto space-y-3 pb-8 px-1 custom-scrollbar transition-colors ${isDragging ? 'bg-white/[0.01] rounded-xl border border-dashed border-white/10' : ''}`}>
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 p-3 rounded cursor-pointer transition-all group relative"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors">{lead.name}</h4>
                          <p className="text-[11px] text-zinc-500 truncate mt-0.5 max-w-[180px]">{lead.company || lead.phone}</p>
                        </div>
                        <div className="flex gap-1 items-center">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${tempStyles[lead.temperature] || tempStyles.COLD}`}>
                            {lead.temperature}
                          </span>
                        </div>
                      </div>
                      
                      {lead.value && (
                        <div className="text-sm font-medium text-zinc-300 mb-3 bg-white/[0.02] px-2 py-1 rounded-md border border-white/5 inline-block">
                          {lead.value}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{lead.lastContact || "Sem contato"}</span>
                        </div>
                        <Link
                          href={`/conversations`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 text-zinc-400 hover:text-white"
                          title="Abrir Chat"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                  
                  {columnLeads.length === 0 && (
                    <div className="h-24 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-zinc-600 text-[11px]">
                      Arraste leads para cá
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead Card Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-zinc-400" /> Card do Lead
              </h3>
              <button onClick={() => setSelectedLead(null)} className="p-2 text-zinc-500 hover:bg-white/5 hover:text-white rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-zinc-400 border-b border-white/5 pb-2">Informações Pessoais</h4>
                  
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block">Nome</label>
                    <input 
                      type="text" 
                      value={selectedLead.name}
                      onChange={(e) => setSelectedLead({ ...selectedLead, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone (WhatsApp)</label>
                    <input 
                      type="text" 
                      value={selectedLead.phone}
                      disabled
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail</label>
                    <input 
                      type="email" 
                      value={selectedLead.email || ""}
                      onChange={(e) => setSelectedLead({ ...selectedLead, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-zinc-400 border-b border-white/5 pb-2">Detalhes Comerciais</h4>
                  
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block flex items-center gap-1"><Building className="w-3 h-3" /> Empresa</label>
                    <input 
                      type="text" 
                      value={selectedLead.company || ""}
                      onChange={(e) => setSelectedLead({ ...selectedLead, company: e.target.value })}
                      placeholder="Nome da empresa"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Média de Faturamento (Mensal)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-zinc-500 text-sm">R$</span>
                      <input 
                        type="number" 
                        value={selectedLead.monthlyRevenue || ""}
                        onChange={(e) => setSelectedLead({ ...selectedLead, monthlyRevenue: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="0.00"
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-8 pr-3 text-sm focus:outline-none focus:border-white/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block flex items-center gap-1"><Filter className="w-3 h-3" /> Origem do Lead</label>
                    <select 
                      value={selectedLead.origin || ""}
                      onChange={(e) => setSelectedLead({ ...selectedLead, origin: e.target.value || null })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                    >
                      <option value="">Não informado</option>
                      {leadOrigins.map(o => (
                        <option key={o.id} value={o.name}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block flex items-center gap-1"><Tag className="w-3 h-3" /> Produto de Interesse</label>
                    <select 
                      value={selectedLead.productId || ""}
                      onChange={(e) => setSelectedLead({ ...selectedLead, productId: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                    >
                      <option value="">Nenhum / Não definido</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.price ? `- R$ ${p.price}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5 block">Temperatura do Lead</label>
                    <div className="flex gap-2">
                      {(["HOT", "WARM", "COLD"] as const).map(temp => (
                        <button
                          key={temp}
                          onClick={() => {
                            setSelectedLead({ ...selectedLead, temperature: temp });
                            if (selectedLead.conversationId) {
                              void updateConversationTemperature(selectedLead.conversationId, temp);
                            }
                          }}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all ${
                            selectedLead.temperature === temp
                              ? tempStyles[temp]
                              : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10"
                          }`}
                        >
                          {temp === "HOT" ? "🔥 Quente" : temp === "WARM" ? "☀️ Morno" : "❄️ Frio"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">A IA atualiza automaticamente. Você pode sobrescrever.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h4 className="text-sm font-semibold text-zinc-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Maiores Desafios Atuais</h4>
                  <button 
                    onClick={() => handleSuggestChallenges(selectedLead.id)}
                    disabled={isSuggestingChallenges}
                    className="text-[11px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3" />
                    {isSuggestingChallenges ? "Analisando..." : "Sugerir com IA"}
                  </button>
                </div>
                
                <textarea 
                  value={selectedLead.mainChallenges || ""}
                  onChange={(e) => setSelectedLead({ ...selectedLead, mainChallenges: e.target.value })}
                  placeholder="Quais as principais dores e desafios atuais do lead?"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-white/20 transition-all min-h-[120px] resize-none leading-relaxed text-zinc-300"
                />
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-400 border-b border-white/5 pb-2">Anotações Internas</h4>
                <textarea 
                  value={selectedLead.notes || ""}
                  onChange={(e) => setSelectedLead({ ...selectedLead, notes: e.target.value })}
                  placeholder="Anotações gerais sobre a negociação..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-white/20 transition-all min-h-[100px] resize-none text-zinc-400"
                />
              </div>

            </div>

            <div className="p-6 border-t border-white/5 shrink-0 flex justify-end gap-3 bg-white/[0.02]">
              <button 
                onClick={() => setSelectedLead(null)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveLead}
                disabled={isEditingLead}
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors flex items-center gap-2"
              >
                {isEditingLead ? "Salvando..." : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Required Gate Modal */}
      {pendingMove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-white/5">
              <h3 className="font-bold text-lg flex items-center gap-2 text-amber-400">
                <Tag className="w-5 h-5" /> Produto Obrigatório
              </h3>
              <p className="text-sm text-zinc-400 mt-2">
                Para mover o lead para <span className="font-bold text-white">{pendingMove.newStageLabel}</span>, é necessário definir um produto/serviço de interesse.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <select
                value={pendingProductId}
                onChange={(e) => setPendingProductId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-zinc-200"
              >
                <option value="">Selecione um produto...</option>
                {products.filter(p => p.isActive).map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.price ? `- R$ ${p.price}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="p-6 border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => { setPendingMove(null); setPendingProductId(""); }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleConfirmPendingMove()}
                disabled={!pendingProductId}
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Confirmar e Avançar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration / Pipeline Settings Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.02]">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2 text-zinc-100">
                  <Settings className="w-5 h-5 text-zinc-400" /> Configurações Comerciais
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Gerencie os produtos oferecidos e as origens de leads.</p>
              </div>
              <button 
                onClick={() => {
                  setIsConfigModalOpen(false);
                  refreshData();
                }} 
                className="p-2 text-zinc-500 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/5 bg-[#08080a] shrink-0">
              <button
                onClick={() => setConfigTab("products")}
                className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
                  configTab === "products"
                    ? "border-amber-500 text-amber-400 bg-white/[0.02]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Tag className="w-4 h-4" /> Produtos & Serviços
              </button>
              <button
                onClick={() => setConfigTab("origins")}
                className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
                  configTab === "origins"
                    ? "border-amber-500 text-amber-400 bg-white/[0.02]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Filter className="w-4 h-4" /> Origens de Lead
              </button>
              <button
                onClick={() => setConfigTab("stages")}
                className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
                  configTab === "stages"
                    ? "border-amber-500 text-amber-400 bg-white/[0.02]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <LayoutTemplate className="w-4 h-4" /> Estágios do Funil
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0c0c0e]">
              {configTab === "products" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Create product form */}
                  <div className="lg:col-span-1 bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-4 h-fit">
                    <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-amber-500" /> Cadastrar Produto
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1 block">Nome do Produto</label>
                        <input
                          type="text"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="Ex: Consultoria Branding"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1 block">Preço (R$)</label>
                        <input
                          type="number"
                          value={newProductPrice}
                          onChange={(e) => setNewProductPrice(e.target.value)}
                          placeholder="Ex: 5000"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1 block">Descrição</label>
                        <textarea
                          value={newProductDesc}
                          onChange={(e) => setNewProductDesc(e.target.value)}
                          placeholder="Ex: 4 sessões estratégicas..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200 h-20 resize-none"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!newProductName) return;
                          await createProduct({
                            name: newProductName,
                            price: newProductPrice ? parseFloat(newProductPrice) : null,
                            description: newProductDesc || null
                          });
                          setNewProductName("");
                          setNewProductPrice("");
                          setNewProductDesc("");
                          refreshData();
                        }}
                        disabled={!newProductName}
                        className="w-full py-2.5 rounded-lg text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Salvar Produto
                      </button>
                    </div>
                  </div>

                  {/* Product List */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="font-bold text-sm text-zinc-200">Produtos Ativos ({products.filter(p => p.isActive).length})</h4>
                    
                    <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                      {products.filter(p => p.isActive).map(p => (
                        <div key={p.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-start justify-between gap-4">
                          {editingProductId === p.id ? (
                            <div className="flex-1 space-y-3">
                              <input
                                type="text"
                                value={editingProductName}
                                onChange={(e) => setEditingProductName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200"
                              />
                              <input
                                type="number"
                                value={editingProductPrice}
                                onChange={(e) => setEditingProductPrice(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200"
                              />
                              <textarea
                                value={editingProductDesc}
                                onChange={(e) => setEditingProductDesc(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-200 h-16 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await updateProduct(p.id, {
                                      name: editingProductName,
                                      price: editingProductPrice ? parseFloat(editingProductPrice) : null,
                                      description: editingProductDesc || null
                                    });
                                    setEditingProductId(null);
                                    refreshData();
                                  }}
                                  className="px-3 py-1 bg-emerald-500 text-black text-xs font-bold rounded"
                                >
                                  Salvar
                                </button>
                                <button onClick={() => setEditingProductId(null)} className="px-3 py-1 bg-zinc-800 text-white text-xs font-bold rounded">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-zinc-200">{p.name}</span>
                                {p.price != null && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">
                                    R$ {p.price.toLocaleString("pt-BR")}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">{p.description || "Sem descrição"}</p>
                            </div>
                          )}
                          
                          {editingProductId !== p.id && (
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingProductId(p.id);
                                  setEditingProductName(p.name);
                                  setEditingProductPrice(p.price?.toString() || "");
                                  setEditingProductDesc(p.description || "");
                                }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Deseja mesmo desativar ${p.name}?`)) {
                                    await deleteProduct(p.id);
                                    refreshData();
                                  }
                                }}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : configTab === "origins" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Create Lead Origin form */}
                  <div className="lg:col-span-1 bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-4 h-fit">
                    <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-amber-500" /> Nova Origem
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1 block">Nome da Origem</label>
                        <input
                          type="text"
                          value={newOriginName}
                          onChange={(e) => setNewOriginName(e.target.value)}
                          placeholder="Ex: Instagram Ads, Indicação"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!newOriginName) return;
                          await createLeadOrigin(newOriginName);
                          setNewOriginName("");
                          refreshData();
                        }}
                        disabled={!newOriginName}
                        className="w-full py-2.5 rounded-lg text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Salvar Origem
                      </button>
                    </div>
                  </div>

                  {/* Origin List */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="font-bold text-sm text-zinc-200">Origens Cadastradas ({leadOrigins.length})</h4>
                    
                    <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                      {leadOrigins.map(o => (
                        <div key={o.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4">
                          {editingOriginId === o.id ? (
                            <div className="flex-1 flex gap-2">
                              <input
                                type="text"
                                value={editingOriginName}
                                onChange={(e) => setEditingOriginName(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-zinc-200"
                              />
                              <button
                                onClick={async () => {
                                  await updateLeadOrigin(o.id, editingOriginName);
                                  setEditingOriginId(null);
                                  refreshData();
                                }}
                                className="px-3 py-1 bg-emerald-500 text-black text-xs font-bold rounded"
                              >
                                Salvar
                              </button>
                              <button onClick={() => setEditingOriginId(null)} className="px-3 py-1 bg-zinc-800 text-white text-xs font-bold rounded">
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <span className="font-bold text-sm text-zinc-200">{o.name}</span>
                            </div>
                          )}
                          
                          {editingOriginId !== o.id && (
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingOriginId(o.id);
                                  setEditingOriginName(o.name);
                                }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Deseja mesmo remover a origem ${o.name}?`)) {
                                    await deleteLeadOrigin(o.id);
                                    refreshData();
                                  }
                                }}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Create stage form */}
                  <div className="lg:col-span-1 bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-4 h-fit">
                    <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-amber-500" /> Novo Estágio
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1 block">Nome do Estágio</label>
                        <input
                          type="text"
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                          placeholder="Ex: Reunião Agendada"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2 block">Cor de Exibição</label>
                        <div className="flex flex-wrap gap-2">
                          {STAGE_COLORS.map(c => (
                            <button
                              key={c.class}
                              type="button"
                              onClick={() => setNewStageColor(c.class)}
                              className={`w-6 h-6 rounded-full ${c.class} border-2 transition-all ${
                                newStageColor === c.class ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                              }`}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!newStageName) return;
                          await createPipelineStage(newStageName, newStageColor);
                          setNewStageName("");
                          setNewStageColor("bg-zinc-500");
                          refreshData();
                        }}
                        disabled={!newStageName}
                        className="w-full py-2.5 rounded-lg text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Salvar Estágio
                      </button>
                    </div>
                  </div>

                  {/* Stage List */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="font-bold text-sm text-zinc-200">Estágios Ativos ({pipelineStages.length})</h4>
                    
                    <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                      {pipelineStages.map((stage, index) => (
                        <div key={stage.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4">
                          {editingStageId === stage.id ? (
                            <div className="flex-1 space-y-3">
                              <input
                                type="text"
                                value={editingStageName}
                                onChange={(e) => setEditingStageName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200"
                              />
                              <div>
                                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 block">Alterar Cor</label>
                                <div className="flex flex-wrap gap-2">
                                  {STAGE_COLORS.map(c => (
                                    <button
                                      key={c.class}
                                      type="button"
                                      onClick={() => setEditingStageColor(c.class)}
                                      className={`w-5 h-5 rounded-full ${c.class} border-2 transition-all ${
                                        editingStageColor === c.class ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                                      }`}
                                      title={c.name}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await updatePipelineStage(stage.id, {
                                      name: editingStageName,
                                      color: editingStageColor
                                    });
                                    setEditingStageId(null);
                                    refreshData();
                                  }}
                                  className="px-3 py-1 bg-emerald-500 text-black text-xs font-bold rounded"
                                >
                                  Salvar
                                </button>
                                <button onClick={() => setEditingStageId(null)} className="px-3 py-1 bg-zinc-800 text-white text-xs font-bold rounded">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center gap-3">
                              <span className={`w-3.5 h-3.5 rounded-full ${stage.color}`} />
                              <span className="font-bold text-sm text-zinc-200">{stage.name}</span>
                            </div>
                          )}
                          
                          {editingStageId !== stage.id && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Reordering Up */}
                              <button
                                onClick={async () => {
                                  if (index === 0) return;
                                  const updatedIds = pipelineStages.map(s => s.id);
                                  const temp = updatedIds[index];
                                  updatedIds[index] = updatedIds[index - 1];
                                  updatedIds[index - 1] = temp;
                                  await reorderPipelineStages(updatedIds);
                                  refreshData();
                                }}
                                disabled={index === 0}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Mover para cima"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              
                              {/* Reordering Down */}
                              <button
                                onClick={async () => {
                                  if (index === pipelineStages.length - 1) return;
                                  const updatedIds = pipelineStages.map(s => s.id);
                                  const temp = updatedIds[index];
                                  updatedIds[index] = updatedIds[index + 1];
                                  updatedIds[index + 1] = temp;
                                  await reorderPipelineStages(updatedIds);
                                  refreshData();
                                }}
                                disabled={index === pipelineStages.length - 1}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Mover para baixo"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              <button
                                onClick={() => {
                                  setEditingStageId(stage.id);
                                  setEditingStageName(stage.name);
                                  setEditingStageColor(stage.color || "bg-zinc-500");
                                }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                                title="Editar Estágio"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  const otherStages = pipelineStages.filter(s => s.id !== stage.id);
                                  if (otherStages.length === 0) {
                                    alert("Não é possível excluir o único estágio do funil.");
                                    return;
                                  }
                                  setDeletingStageId(stage.id);
                                  setMigrationStageName(otherStages[0].name);
                                }}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                title="Excluir Estágio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 shrink-0 flex justify-end bg-white/[0.02]">
              <button
                onClick={() => {
                  setIsConfigModalOpen(false);
                  refreshData();
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Fechar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Deletion Migration Modal */}
      {deletingStageId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-white/5">
              <h3 className="font-bold text-lg flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" /> Excluir Estágio Comercial
              </h3>
              <p className="text-sm text-zinc-400 mt-2">
                O estágio <span className="font-bold text-white">"{pipelineStages.find(s => s.id === deletingStageId)?.name}"</span> será removido. Para onde deseja transferir os leads e conversas atualmente nesse estágio?
              </p>
            </div>

            <div className="p-6 space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 block">Estágio de Destino</label>
              <select
                value={migrationStageName}
                onChange={(e) => setMigrationStageName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50 text-zinc-200"
              >
                {pipelineStages
                  .filter(s => s.id !== deletingStageId)
                  .map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))
                }
              </select>
            </div>

            <div className="p-6 border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => { setDeletingStageId(null); setMigrationStageName(""); }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!deletingStageId || !migrationStageName) return;
                  await deletePipelineStage(deletingStageId, migrationStageName);
                  setDeletingStageId(null);
                  setMigrationStageName("");
                  refreshData();
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-400 transition-colors"
              >
                Excluir e Migrar Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
