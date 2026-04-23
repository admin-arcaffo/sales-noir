"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowUpRight, Filter, MessageSquare, Phone, Save, Search, Tag } from "lucide-react";
import { getLeads, updateConversationStage, type LeadData } from "@/actions/crm";

const tempStyles: Record<string, string> = {
  HOT: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  WARM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  COLD: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

const stageLabels: Record<string, string> = {
  PRIMEIRO_CONTATO: "Primeiro Contato",
  QUALIFICACAO: "Qualificação",
  APRESENTACAO_PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  OBJECAO: "Objeção",
  FOLLOW_UP: "Follow-up",
  FECHAMENTO: "Fechamento",
  REATIVACAO: "Reativação",
};

const stageOptions = [
  "PRIMEIRO_CONTATO",
  "QUALIFICACAO",
  "APRESENTACAO_PROPOSTA",
  "NEGOCIACAO",
  "OBJECAO",
  "FOLLOW_UP",
  "FECHAMENTO",
  "REATIVACAO",
];

const stageFilters = ["ALL", ...stageOptions] as const;
const temperatureFilters = ["ALL", "HOT", "WARM", "COLD"] as const;

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [draftStage, setDraftStage] = useState<string>("PRIMEIRO_CONTATO");
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<(typeof stageFilters)[number]>("ALL");
  const [temperatureFilter, setTemperatureFilter] = useState<(typeof temperatureFilters)[number]>("ALL");
  const [isSavingStage, setIsSavingStage] = useState(false);

  useEffect(() => {
    let alive = true;

    getLeads()
      .then((result) => {
        if (!alive) {
          return;
        }

        setLeads(result);
        setSelectedLeadId((current) => current ?? result[0]?.id ?? null);
        setDraftStage(result[0]?.stageKey || "PRIMEIRO_CONTATO");
      })
      .catch((error) => {
        console.error("Failed to load leads:", error);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filteredLeads = leads.filter((lead) => {
    const haystack = [lead.name, lead.company, lead.phone, lead.origin, lead.stage, lead.notes || ""]
      .join(" ")
      .toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === "ALL" || lead.stageKey === stageFilter;
    const matchesTemperature = temperatureFilter === "ALL" || lead.temperature === temperatureFilter;

    return matchesSearch && matchesStage && matchesTemperature;
  });

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;

  const selectLead = (lead: LeadData) => {
    setSelectedLeadId(lead.id);
    setDraftStage(lead.stageKey);
  };

  const handleSaveStage = async () => {
    if (!selectedLead?.conversationId) {
      return;
    }

    setIsSavingStage(true);
    try {
      await updateConversationStage(selectedLead.conversationId, draftStage);
      setLeads((current) => current.map((lead) => (
        lead.id === selectedLead.id
          ? { ...lead, stageKey: draftStage, stage: stageLabels[draftStage] || draftStage }
          : lead
      )));
    } catch (error) {
      console.error("Failed to update stage:", error);
    } finally {
      setIsSavingStage(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Leads</h1>
            <p className="text-sm text-zinc-500 mt-1">Gerencie contatos, estágio e temperatura comercial</p>
          </div>
          <button className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors">
            + Novo Lead
          </button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, empresa, telefone ou nota..."
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {temperatureFilters.map((value) => (
              <button
                key={value}
                onClick={() => setTemperatureFilter(value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  temperatureFilter === value
                    ? "bg-white text-black border-white"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {value === "ALL" ? "Todas temperaturas" : value}
              </button>
            ))}
            <button className="px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 text-sm rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {stageFilters.map((value) => (
            <button
              key={value}
              onClick={() => setStageFilter(value)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                stageFilter === value
                  ? "bg-white text-black border-white"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
              }`}
            >
              {value === "ALL" ? "Todos os estágios" : stageLabels[value] || value}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-6 items-start">
          <div className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-200">Lista de Leads</p>
                <p className="text-xs text-zinc-500">{filteredLeads.length} resultados</p>
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] uppercase tracking-wider text-zinc-500 font-semibold px-5 py-3">Nome</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-zinc-500 font-semibold px-5 py-3">Empresa</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-zinc-500 font-semibold px-5 py-3">Estágio</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-zinc-500 font-semibold px-5 py-3">Temp.</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-zinc-500 font-semibold px-5 py-3">Valor</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-zinc-500 font-semibold px-5 py-3">Último Contato</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLeads.length > 0 ? filteredLeads.map((lead) => {
                  const isSelected = lead.id === selectedLeadId;

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => selectLead(lead)}
                      className={`cursor-pointer group transition-colors ${isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] font-semibold text-zinc-400 border border-zinc-700/50">
                            {lead.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="text-sm text-zinc-200 font-medium">{lead.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-zinc-400">{lead.company}</td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] text-zinc-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded">{lead.stage}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${tempStyles[lead.temperature] || tempStyles.COLD}`}>
                          {lead.temperature}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-zinc-400 font-medium">{lead.value}</td>
                      <td className="px-5 py-4 text-sm text-zinc-500">{lead.lastContact}</td>
                      <td className="px-5 py-4">
                        <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td className="px-5 py-10 text-sm text-zinc-500" colSpan={7}>
                      Nenhum lead encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-5 space-y-5 sticky top-6">
            {selectedLead ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Detalhe do Lead</p>
                    <h2 className="text-lg font-semibold text-zinc-100 mt-1">{selectedLead.name}</h2>
                    <p className="text-sm text-zinc-500">{selectedLead.company}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${tempStyles[selectedLead.temperature] || tempStyles.COLD}`}>
                    {selectedLead.temperature}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <Row label="Telefone" value={selectedLead.phone} icon={Phone} />
                  <Row label="Origem" value={selectedLead.origin} icon={Tag} />
                  <Row label="Último contato" value={selectedLead.lastContact} icon={MessageSquare} />
                  <Row label="Valor potencial" value={selectedLead.value} icon={Save} />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Estágio atual</label>
                  <select
                    value={draftStage}
                    onChange={(event) => setDraftStage(event.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  >
                    {stageOptions.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabels[stage] || stage}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveStage}
                    disabled={isSavingStage || draftStage === selectedLead.stageKey || !selectedLead.conversationId}
                    className="w-full px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingStage ? "Salvando..." : "Salvar estágio"}
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Anotações</p>
                  <p className="text-sm text-zinc-400 leading-relaxed bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 min-h-24">
                    {selectedLead.notes || "Sem anotações registradas."}
                  </p>
                </div>

                <Link
                  href="/conversations"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-zinc-200 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors"
                >
                  Abrir conversa
                </Link>
              </>
            ) : (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center text-zinc-600 gap-3">
                <Search className="w-8 h-8 text-zinc-800" />
                <p className="text-sm">Selecione um lead para ver os detalhes</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
      <Icon className="w-4 h-4 text-zinc-500 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
        <p className="text-sm text-zinc-200 break-words">{value}</p>
      </div>
    </div>
  );
}
