"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowUpRight, Filter, MessageSquare, Phone, Save, Search, Tag, Users, Edit, X, Wand2, Mail, Building, LayoutTemplate, Briefcase, TrendingUp, AlertTriangle } from "lucide-react";
import { 
  getLeads, 
  updateConversationStage, 
  getPipelineStages, 
  getProducts, 
  updateContactProfile, 
  suggestChallengesFromAI,
  type LeadData, 
  type PipelineStageData, 
  type ProductData 
} from "@/actions/crm";

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

  useEffect(() => {
    let alive = true;
    Promise.all([
      getLeads(),
      getPipelineStages(),
      getProducts()
    ])
      .then(([leadsResult, stagesResult, productsResult]) => {
        if (!alive) return;
        setLeads(leadsResult);
        setPipelineStages(stagesResult);
        setProducts(productsResult);
      })
      .catch((error) => console.error("Failed to load data:", error));
    return () => { alive = false; };
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

    // Optimistic Update
    setLeads(current => current.map(l => 
      l.id === leadId ? { ...l, stageKey: newStage, stage: newStageLabel } : l
    ));

    // Server Update
    if (lead.conversationId) {
      try {
        await updateConversationStage(lead.conversationId, newStage);
      } catch (error) {
        console.error("Failed to update stage:", error);
      }
    }
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
      <header className="p-6 md:p-8 shrink-0 flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-white/[0.06] bg-[#0a0a0c]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 flex items-center gap-3">
            Pipeline Comercial
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              {filteredLeads.length} Leads
            </span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie a jornada dos seus clientes arrastando os cards pelo funil.</p>
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
                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[11px] font-medium border transition-colors ${
                  temperatureFilter === value
                    ? "bg-white text-black border-white"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {value === "ALL" ? "Todos" : value}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-[#0c0c0e]">
        <div className="flex h-full gap-4 pb-4 min-w-max">
          {activeStages.map((column) => {
            const columnLeads = filteredLeads.filter(l => l.stageKey === column.id);
            
            return (
              <div 
                key={column.id} 
                className="flex flex-col w-[320px] shrink-0 h-full max-h-full"
                onDragOver={handleDragOver}
                onDrop={(e) => void handleDrop(e, column.id)}
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${column.color}`} />
                    <h3 className="font-semibold text-sm text-zinc-200">{column.title}</h3>
                  </div>
                  <span className="text-xs font-medium text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
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
                      className="bg-white/[0.03] border border-white/[0.06] hover:border-white/20 p-4 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all group relative"
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
    </div>
  );
}
