"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Filter, MessageSquare, Phone, Save, Search, Tag, Users, Edit, X, Wand2, Mail, Building, LayoutTemplate, Briefcase, TrendingUp, AlertTriangle, Settings, Plus, Trash2, Lock, User, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { 
  getLeads, 
  updateConversationStage, 
  updateConversationTemperature,
  getPipelineStages, 
  getProducts, 
  updateContactProfile, 
  suggestChallengesFromAI,
  getCurrentUserId,
  getCurrentUserInfo,
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
  reorderPipelineStages,
  getOrganizationUsers,
  getPipelineDashboardData,
  createLead,
  deleteLead
} from "@/actions/crm";

const MeetingModal = lazy(() => import("@/app/(app)/_components/MeetingModal").then((module) => ({ default: module.MeetingModal })));
const QuoteEditor = lazy(() => import("@/app/(app)/_components/QuoteEditor").then((module) => ({ default: module.QuoteEditor })));
const TaskModal = lazy(() => import("@/app/(app)/_components/TaskModal").then((module) => ({ default: module.TaskModal })));
const ClosedDealModal = lazy(() => import("@/components/modals/ClosedDealModal").then((module) => ({ default: module.ClosedDealModal })));
const InviteMasterclassModal = lazy(() => import("@/components/modals/InviteMasterclassModal").then((module) => ({ default: module.InviteMasterclassModal })));

type OrganizationUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type TaskLeadDraft = {
  lead: LeadData;
  title?: string;
  description?: string;
  priority?: string;
  source?: string;
};

const STAGES_REQUIRING_PRODUCT = ["APRESENTACAO_PROPOSTA", "NEGOCIACAO", "OBJECAO", "FOLLOW_UP", "FECHAMENTO"];

const tempStyles: Record<string, string> = {
  HOT: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  WARM: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  COLD: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
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

function normalizeStageText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isClosedDealStage(value: string) {
  const normalized = normalizeStageText(value);
  return normalized.includes("fechamento") || normalized.includes("negocio fechado") || normalized.includes("negocios fechados") || normalized.includes("contrato fechado");
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
}

function formatShortDate(value: string | number | null | undefined) {
  if (value == null) return "sem data";
  if (typeof value === "number") return `${value}º dia`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

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
  const { showToast } = useToast();
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("ALL");
  const [ownershipFilter, setOwnershipFilter] = useState<"ALL" | "MINE">("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [quickView, setQuickView] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Create Lead Modal states
  const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  const [newLeadOrigin, setNewLeadOrigin] = useState("");
  const [newLeadProduct, setNewLeadProduct] = useState("");
  const [newLeadTemp, setNewLeadTemp] = useState("COLD");
  const [newLeadAssignedUser, setNewLeadAssignedUser] = useState("");
  const [newLeadStage, setNewLeadStage] = useState("");
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [taskLead, setTaskLead] = useState<TaskLeadDraft | null>(null);
  const hasAppliedLeadParamRef = useRef(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [isSuggestingChallenges, setIsSuggestingChallenges] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  // Product-required gate modal
  const [pendingMove, setPendingMove] = useState<{ leadId: string; newStage: string; newStageLabel: string } | null>(null);
  const [pendingClosedDeal, setPendingClosedDeal] = useState<{ leadId: string; newStage: string; newStageLabel: string } | null>(null);
  const [inviteMasterclassLeadId, setInviteMasterclassLeadId] = useState<string | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string>("");

  // Meeting Scheduling State
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [meetingContact, setMeetingContact] = useState<{id: string, name: string, email: string} | null>(null);

  const [confirmDeleteLeadId, setConfirmDeleteLeadId] = useState<string | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("pipeline:collapsed");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

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
    getPipelineDashboardData()
      .then((data) => {
        setLeads(data.leads);
        setSelectedLead((current) => current ? data.leads.find((lead) => lead.id === current.id) || current : current);
        setPipelineStages(data.stages);
        setProducts(data.products);
        setLeadOrigins(data.origins);
        setOrganizationUsers(data.users);
      })
      .catch((error) => console.error("Failed to load data:", error));
  };

  useEffect(() => {
    refreshData();
    getCurrentUserInfo().then(info => {
      setCurrentUserId(info?.id || null);
      setCurrentUserRole(info?.role || null);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || hasAppliedLeadParamRef.current || leads.length === 0) return;

    const requestedLeadId = new URLSearchParams(window.location.search).get("leadId");
    if (!requestedLeadId) return;

    const lead = leads.find((item) => item.id === requestedLeadId);
    if (!lead) return;

    hasAppliedLeadParamRef.current = true;
    setSelectedLead(lead);
  }, [leads]);

  const activeStages = pipelineStages.length > 0 
    ? pipelineStages.map(s => ({ id: s.name, title: s.name, color: s.color }))
    : KANBAN_STAGES;

  const getDaysSinceLastContact = (lead: LeadData) => {
    if (!lead.lastContactAt) return 999;
    return Math.floor((Date.now() - new Date(lead.lastContactAt).getTime()) / (1000 * 60 * 60 * 24));
  };

  const isHotStale = (lead: LeadData) => lead.temperature === "HOT" && getDaysSinceLastContact(lead) >= 1;
  const hasNoNextAction = (lead: LeadData) => lead.openTasksCount === 0;
  const isProposalWithoutFollowUp = (lead: LeadData) => lead.stage.toLowerCase().includes("proposta") && lead.openTasksCount === 0;

  const filteredLeads = leads.filter((lead) => {
    const haystack = [
      lead.name,
      lead.company,
      lead.phone,
      lead.origin,
      lead.notes || "",
      lead.assignedUserName || "",
      ...lead.productNames,
    ].join(" ").toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesTemperature = temperatureFilter === "ALL" || lead.temperature === temperatureFilter;
    const matchesOwnership = ownershipFilter === "ALL" || (currentUserId && lead.assignedUserId === currentUserId);
    const matchesUser = userFilter === "ALL" || (userFilter === "UNASSIGNED" ? !lead.assignedUserId : lead.assignedUserId === userFilter);
    const matchesProduct = productFilter === "ALL" || (productFilter === "NONE" ? lead.productIds.length === 0 : lead.productIds.includes(productFilter));
    const matchesOrigin = originFilter === "ALL" || lead.origin === originFilter;
    const matchesQuickView = quickView === "ALL"
      || (quickView === "HOT_STALE" && isHotStale(lead))
      || (quickView === "NO_NEXT_ACTION" && hasNoNextAction(lead))
      || (quickView === "OVERDUE_TASKS" && lead.overdueTasksCount > 0)
      || (quickView === "PROPOSAL_NO_FOLLOWUP" && isProposalWithoutFollowUp(lead))
      || (quickView === "NO_PRODUCT" && lead.productIds.length === 0)
      || (quickView === "HIGH_RISK" && (lead.latestRiskLevel === "ALTO" || lead.latestUrgency === "CRITICA"));
    return matchesSearch && matchesTemperature && matchesOwnership && matchesUser && matchesProduct && matchesOrigin && matchesQuickView;
  });

  const activeFiltersCount = 
    (userFilter !== "ALL" ? 1 : 0) +
    (productFilter !== "ALL" ? 1 : 0) +
    (originFilter !== "ALL" ? 1 : 0) +
    (temperatureFilter !== "ALL" ? 1 : 0) +
    (ownershipFilter !== "ALL" ? 1 : 0);

  const hasAdvancedFilters = activeFiltersCount > 0 || quickView !== "ALL";

  const quickViews = [
    { id: "ALL", label: "Todas", count: leads.length },
    { id: "HOT_STALE", label: "Quentes parados", count: leads.filter(isHotStale).length },
    { id: "NO_NEXT_ACTION", label: "Sem próxima ação", count: leads.filter(hasNoNextAction).length },
    { id: "OVERDUE_TASKS", label: "Tarefas vencidas", count: leads.filter((lead) => lead.overdueTasksCount > 0).length },
    { id: "PROPOSAL_NO_FOLLOWUP", label: "Propostas sem follow-up", count: leads.filter(isProposalWithoutFollowUp).length },
    { id: "NO_PRODUCT", label: "Sem produto", count: leads.filter((lead) => lead.productIds.length === 0).length },
    { id: "HIGH_RISK", label: "Risco alto", count: leads.filter((lead) => lead.latestRiskLevel === "ALTO" || lead.latestUrgency === "CRITICA").length },
  ];

  const getSuggestedTaskForStage = (lead: LeadData, stageLabel: string): TaskLeadDraft | null => {
    const stage = stageLabel.toLowerCase();
    if (stage.includes("fechamento") || stage.includes("agendado")) return null;
    if (stage.includes("proposta")) {
      return {
        lead,
        title: `Cobrar retorno da proposta de ${lead.name}`,
        description: `Sugestão automática criada após mover o lead para ${stageLabel}.`,
        priority: lead.temperature === "HOT" ? "HIGH" : "MEDIUM",
        source: "PIPELINE_STAGE",
      };
    }
    if (stage.includes("negocia") || stage.includes("obje")) {
      return {
        lead,
        title: `Mapear objeções e próximo passo com ${lead.name}`,
        description: `Sugestão automática criada após mover o lead para ${stageLabel}.`,
        priority: "HIGH",
        source: "PIPELINE_STAGE",
      };
    }
    if (stage.includes("follow")) {
      return {
        lead,
        title: `Fazer follow-up com ${lead.name}`,
        description: `Sugestão automática criada após mover o lead para ${stageLabel}.`,
        priority: "MEDIUM",
        source: "PIPELINE_STAGE",
      };
    }
    return {
      lead,
      title: `Definir próxima ação com ${lead.name}`,
      description: `Sugestão automática criada após mover o lead para ${stageLabel}.`,
      priority: "MEDIUM",
      source: "PIPELINE_STAGE",
    };
  };

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

    // Gate: Agendamento de reunião
    if (newStageLabel.toLowerCase() === "agendado") {
      setMeetingContact({
        id: lead.id,
        name: lead.name,
        email: lead.email || ""
      });
      setMeetingModalOpen(true);
      // Salva o movimento pendente para executar DEPOIS de agendar com sucesso
      setPendingMove({ leadId, newStage, newStageLabel });
      return;
    }

    // Gate: Closed Deal
    if (isClosedDealStage(newStageLabel) || isClosedDealStage(newStage)) {
      setPendingClosedDeal({ leadId, newStage, newStageLabel });
      return;
    }

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

    const updatedLead = { ...lead, stageKey: newStage, stage: newStageLabel };
    const suggestedTask = getSuggestedTaskForStage(updatedLead, newStageLabel);
    if (suggestedTask) {
      setTaskLead(suggestedTask);
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

  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    try {
      await deleteLead(selectedLead.id);
      setLeads((current) => current.filter((l) => l.id !== selectedLead.id));
      setSelectedLead(null);
      setConfirmDeleteLeadId(null);
      showToast("Lead excluído.", "success");
    } catch (error) {
      console.error("Failed to delete lead:", error);
      showToast("Erro ao excluir lead.", "error");
      setConfirmDeleteLeadId(null);
    }
  };

  const toggleCollapseStage = (stageId: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("pipeline:collapsed", JSON.stringify([...next]));
      }
      return next;
    });
  };

  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      showToast("Nome e telefone são obrigatórios.", "error");
      return;
    }

    setIsSubmittingLead(true);
    try {
      const result = await createLead({
        name: newLeadName.trim(),
        phone: newLeadPhone.trim(),
        email: newLeadEmail.trim() || undefined,
        company: newLeadCompany.trim() || undefined,
        origin: newLeadOrigin || undefined,
        productId: newLeadProduct || undefined,
        temperature: newLeadTemp,
        assignedUserId: newLeadAssignedUser || undefined,
        stage: newLeadStage || undefined,
      });

      if (result.success) {
        showToast("Lead criado com sucesso!", "success");
        setIsCreateLeadModalOpen(false);
        setNewLeadName("");
        setNewLeadPhone("");
        setNewLeadEmail("");
        setNewLeadCompany("");
        setNewLeadOrigin("");
        setNewLeadProduct("");
        setNewLeadTemp("COLD");
        setNewLeadAssignedUser("");
        setNewLeadStage("");
        refreshData();
      }
    } catch (err: any) {
      showToast(err?.message || "Erro ao criar lead.", "error");
    } finally {
      setIsSubmittingLead(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="p-6 md:p-8 shrink-0 flex flex-col gap-4 border-b border-zinc-900 bg-[#09090b]">
        {/* Row 1: Title, Search, Filter Toggle, Settings */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-3">
              Pipeline Comercial
              <span className="text-[10px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                {filteredLeads.length} Leads
              </span>
            </h1>
            <p className="label-mono mt-1">Gerencie a jornada dos seus clientes arrastando os cards pelo funil.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar leads..."
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600 text-zinc-200"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* Criar Lead Button */}
              <button
                onClick={() => setIsCreateLeadModalOpen(true)}
                className="py-2 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-600 text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Lead</span>
              </button>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`py-2 px-3.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  showFilters || activeFiltersCount > 0
                    ? "bg-[#6366f1]/10 border-[#6366f1]/40 text-indigo-300 hover:bg-[#6366f1]/20"
                    : "bg-[#0f0f11] border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filtros</span>
                {activeFiltersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500 text-white font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="p-2 py-2 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
                title="Configurações da Pipeline"
              >
                <Settings className="w-4 h-4" />
                <span className="text-xs font-semibold sm:hidden md:inline">Configurações</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Filters Row */}
        {showFilters && (
          <div className="p-4 rounded-xl border border-zinc-800 bg-[#0d0d0f] flex flex-col md:flex-row md:items-center gap-4 animate-in slide-in-from-top-2 duration-200 flex-wrap">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 flex-wrap">
              {/* Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto flex-1 max-w-2xl">
                <select
                  value={userFilter}
                  onChange={(event) => {
                    setUserFilter(event.target.value);
                    if (event.target.value !== "ALL") setOwnershipFilter("ALL");
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-350 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="ALL">Todos os responsáveis</option>
                  <option value="UNASSIGNED">Sem responsável</option>
                  {organizationUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.name || user.email}</option>
                  ))}
                </select>

                <select
                  value={productFilter}
                  onChange={(event) => setProductFilter(event.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-355 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="ALL">Todos os produtos</option>
                  <option value="NONE">Sem produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>

                <select
                  value={originFilter}
                  onChange={(event) => setOriginFilter(event.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-355 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="ALL">Todas as origens</option>
                  {leadOrigins.map((origin) => (
                    <option key={origin.id} value={origin.name}>{origin.name}</option>
                  ))}
                </select>
              </div>

              {/* Toggles (Ownership & Temperature) */}
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <div className="flex gap-0.5 rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
                  {["ALL", "MINE"].map((value) => (
                    <button
                      key={value}
                      onClick={() => setOwnershipFilter(value as "ALL" | "MINE")}
                      className={`px-2.5 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        ownershipFilter === value
                          ? "bg-indigo-500 text-white shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {value === "ALL" ? "Todos os Leads" : "Meus"}
                    </button>
                  ))}
                </div>

                <div className="flex gap-0.5 rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
                  {["ALL", "HOT", "WARM", "COLD"].map((value) => (
                    <button
                      key={value}
                      onClick={() => setTemperatureFilter(value)}
                      className={`px-2.5 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        temperatureFilter === value
                          ? "bg-zinc-100 text-black shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {value === "ALL" ? "Todos" : value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Clear Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setUserFilter("ALL");
                  setProductFilter("ALL");
                  setOriginFilter("ALL");
                  setTemperatureFilter("ALL");
                  setOwnershipFilter("ALL");
                }}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-all cursor-pointer whitespace-nowrap align-middle"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Row 3: Quick Views Pills */}
        <div className="flex w-full basis-full gap-2 overflow-x-auto pb-1 no-scrollbar items-center border-t border-zinc-900/50 pt-2">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mr-2 shrink-0">Atalhos rápidos:</span>
          {quickViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setQuickView(view.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                quickView === view.id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              }`}
            >
              {view.label}
              <span className="ml-2 font-mono text-zinc-500">{view.count}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-[#040406]">
        <div className="flex h-full gap-4 pb-4 min-w-max">
          {activeStages.map((column) => {
            const columnLeads = filteredLeads.filter(l => l.stageKey === column.id);
            const columnSum = columnLeads.reduce((sum, l) => sum + (l.totalProductValue || 0), 0);
            const formattedSum = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(columnSum);
            
            return (
              <div 
                key={column.id} 
                className={`flex flex-col shrink-0 h-full max-h-full bg-[#050507] border border-zinc-900 rounded p-3 transition-all duration-200 overflow-hidden ${
                  collapsedStages.has(column.id) ? "w-14" : "w-[320px]"
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => void handleDrop(e, column.id)}
              >
                <div className={`flex items-center gap-2 mb-4 px-1 ${collapsedStages.has(column.id) ? "flex-col" : "justify-between"}`}>
                  <div className={`flex items-center gap-2 ${collapsedStages.has(column.id) ? "flex-col" : ""}`}>
                    <button
                      onClick={() => toggleCollapseStage(column.id)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                    >
                      {collapsedStages.has(column.id) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <span className={`w-1.5 h-1.5 rounded-full ${column.color} shrink-0`} />
                    <h3 className={`text-[10px] font-bold text-zinc-300 uppercase tracking-wider ${collapsedStages.has(column.id) ? "hidden" : ""}`}>{column.title}</h3>
                  </div>
                  <div className={`flex items-center gap-1.5 ${collapsedStages.has(column.id) ? "flex-col" : ""}`}>
                    {columnSum > 0 && (
                      <span className={`font-mono text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold ${collapsedStages.has(column.id) ? "hidden" : ""}`}>
                        {formattedSum}
                      </span>
                    )}
                    <span className="font-mono text-[9px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850">
                      {columnLeads.length}
                    </span>
                  </div>
                </div>

                <div className={`flex-1 overflow-y-auto space-y-3 pb-8 px-1 custom-scrollbar transition-colors ${isDragging ? 'bg-white/[0.01] rounded-xl border border-dashed border-white/10' : ''} ${collapsedStages.has(column.id) ? 'hidden' : ''}`}>
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
                          {lead.assignedUserName && (
                            <p className="text-[10px] text-indigo-400/70 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3" /> {lead.assignedUserName}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 items-center">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${tempStyles[lead.temperature] || tempStyles.COLD}`}>
                            {lead.temperature}
                          </span>
                        </div>
                      </div>
                      
                      {lead.totalProductValueFormatted && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-3 bg-emerald-500/10 px-2 py-1.5 rounded-md border border-emerald-500/20 inline-flex">
                          <span>{lead.totalProductValueFormatted}</span>
                        </div>
                      )}

                      {lead.closedDeal && (
                        <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] p-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                              <Briefcase className="w-3 h-3" /> Venda despachada
                            </span>
                            <span className="text-[10px] font-mono text-emerald-200">{formatMoney(lead.closedDeal.totalValue)}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 flex flex-col gap-0.5">
                            <span className="truncate">{lead.closedDeal.installmentCount || 1}x | {lead.closedDeal.paymentMethod || "PIX"} | Venc: {formatShortDate(lead.closedDeal.firstPaymentDate)}</span>
                            {lead.closedDeal.hasSignal && (
                              <span className="text-emerald-400">Sinal: {formatMoney(lead.closedDeal.signalValue)}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500">Despacho: {formatDateTime(lead.closedDeal.closedAt)}</div>
                          {lead.closedDeal.projectDuration && (
                            <div className="text-[10px] text-zinc-500">Projeto: {lead.closedDeal.projectDuration}</div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        {lead.overdueTasksCount > 0 && (
                          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-300 flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            {lead.overdueTasksCount} tarefa{lead.overdueTasksCount > 1 ? "s" : ""} vencida{lead.overdueTasksCount > 1 ? "s" : ""}
                          </div>
                        )}

                        {!lead.nextTask && (
                          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
                            Sem próxima ação definida
                          </div>
                        )}

                        {lead.nextTask && (
                          <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-400">
                            <span className="font-bold text-zinc-300">Próxima:</span> {lead.nextTask.title} • {lead.nextTask.due}
                          </div>
                        )}

                        {(lead.latestRiskLevel === "ALTO" || lead.latestUrgency === "CRITICA") && (
                          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-300">
                            IA: {lead.latestUrgency === "CRITICA" ? "urgência crítica" : "risco alto"}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{lead.lastContact || "Sem contato"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setTaskLead({ lead });
                            }}
                            className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 text-emerald-300"
                            title="Criar tarefa para este lead"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        {(lead.assignedUserId === currentUserId || currentUserRole === 'owner') ? (
                          <Link
                            href={`/conversations`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 text-zinc-400 hover:text-white"
                            title="Abrir Chat"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-zinc-600 cursor-not-allowed" title="Conversa de outro membro">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        )}
                        </div>
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
                    <Suspense fallback={<div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-zinc-500">Carregando orçamento...</div>}>
                      <QuoteEditor 
                        contactId={selectedLead.id}
                        contactProducts={selectedLead.contactProducts || []}
                        catalogProducts={products}
                        onUpdate={async () => {
                          const updatedLeads = await getLeads();
                          setLeads(updatedLeads);
                          const updatedLead = updatedLeads.find(l => l.id === selectedLead.id);
                          if (updatedLead) setSelectedLead(updatedLead);
                        }}
                      />
                    </Suspense>
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

              {!selectedLead.closedDeal && (isClosedDealStage(selectedLead.stage) || isClosedDealStage(selectedLead.stageKey)) && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Venda ainda nao despachada
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">Preencha os dados financeiros para registrar o fechamento.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingClosedDeal({ leadId: selectedLead.id, newStage: selectedLead.stageKey, newStageLabel: selectedLead.stage })}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                  >
                    Despachar Venda
                  </button>
                </div>
              )}

              {selectedLead.closedDeal && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 border-b border-emerald-500/10 pb-3">
                    <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Despacho da Venda
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-emerald-200">
                        Despachado em {formatDateTime(selectedLead.closedDeal.closedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingClosedDeal({ leadId: selectedLead.id, newStage: selectedLead.stageKey, newStageLabel: selectedLead.stage })}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                      >
                        Editar despacho
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Valor total</p>
                      <p className="text-sm font-bold text-white mt-1">{formatMoney(selectedLead.closedDeal.totalValue)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Parcelas</p>
                      <p className="text-sm font-bold text-white mt-1">{selectedLead.closedDeal.installmentCount || 1}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Tempo de projeto</p>
                      <p className="text-sm font-bold text-white mt-1">{selectedLead.closedDeal.projectDuration || "Nao informado"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Vencimento</p>
                      <p className="text-sm font-bold text-white mt-1">{formatShortDate(selectedLead.closedDeal.firstPaymentDate)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Pagamento</p>
                      <p className="text-sm font-bold text-white mt-1">{selectedLead.closedDeal.paymentMethod || "Nao informado"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Sinal</p>
                      <p className="text-sm font-bold text-white mt-1">{selectedLead.closedDeal.hasSignal ? formatMoney(selectedLead.closedDeal.signalValue) : "Nao"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Observacoes da venda</p>
                      <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap">{selectedLead.closedDeal.notes || "Nenhuma observacao"}</p>
                    </div>
                  </div>
                </div>
              )}

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

            <div className="p-6 border-t border-white/5 shrink-0 flex flex-col-reverse md:flex-row md:items-center gap-3 bg-white/[0.02]">
              <div className="flex flex-wrap items-center gap-2">
                {confirmDeleteLeadId === selectedLead.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleDeleteLead()}
                      className="px-4 py-2.5 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmDeleteLeadId(null)}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteLeadId(selectedLead.id)}
                    className="px-3 py-2.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                <button
                  onClick={() => setInviteMasterclassLeadId(selectedLead.id)}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  Masterclass
                </button>
                <button
                  onClick={() => setTaskLead({ lead: selectedLead })}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Tarefa
                </button>
                <button 
                  onClick={() => { setSelectedLead(null); setConfirmDeleteLeadId(null); }}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveLead}
                  disabled={isEditingLead}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isEditingLead ? "Salvando..." : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingClosedDeal && (
        <Suspense fallback={null}>
          <ClosedDealModal
            leadId={pendingClosedDeal.leadId}
            leadName={leads.find(l => l.id === pendingClosedDeal.leadId)?.name || "Lead"}
            targetStage={pendingClosedDeal.newStageLabel || pendingClosedDeal.newStage}
            onClose={() => setPendingClosedDeal(null)}
            onSuccess={() => {
              showToast("Venda despachada e e-mail enviado com sucesso!", "success");
              const targetStage = { id: pendingClosedDeal.newStage, title: pendingClosedDeal.newStageLabel };
              void executeStageMove(pendingClosedDeal.leadId, targetStage.id, targetStage.title).then(refreshData);
              setPendingClosedDeal(null);
            }}
          />
        </Suspense>
      )}

      {inviteMasterclassLeadId && (
        <Suspense fallback={null}>
          <InviteMasterclassModal
            leadId={inviteMasterclassLeadId}
            leadName={leads.find(l => l.id === inviteMasterclassLeadId)?.name || "Lead"}
            onClose={() => setInviteMasterclassLeadId(null)}
            onSuccess={() => {
              showToast("Convite de Masterclass enviado com sucesso!", "success");
              setInviteMasterclassLeadId(null);
            }}
          />
        </Suspense>
      )}

      {taskLead && (
        <Suspense fallback={null}>
          <TaskModal
            isOpen={Boolean(taskLead)}
            onClose={() => setTaskLead(null)}
            contactId={taskLead?.lead.id || null}
            contactName={taskLead?.lead.name || ""}
            defaultTitle={taskLead?.title || (taskLead ? `Fazer follow-up com ${taskLead.lead.name}` : "")}
            defaultDescription={taskLead?.description || (taskLead ? `Tarefa criada a partir da pipeline. Estágio atual: ${taskLead.lead.stage}.` : "")}
            defaultType="FOLLOW_UP"
            defaultPriority={taskLead?.priority || (taskLead?.lead.temperature === "HOT" ? "HIGH" : "MEDIUM")}
            defaultSource={taskLead?.source || "MANUAL"}
            defaultConversationId={taskLead?.lead.conversationId || null}
          />
        </Suspense>
      )}

      {/* Product Required Gate Modal */}
      {pendingMove && STAGES_REQUIRING_PRODUCT.includes(pendingMove.newStage) && (
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
                onClick={() => { 
                  setPendingMove(null); 
                  setPendingProductId(""); 
                  setLeads(current => [...current]); // Force render to reset stuck drag-and-drop visuals
                }}
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
                                    showToast("Não é possível excluir o único estágio do funil.", "error");
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

      {meetingModalOpen && meetingContact && (
        <Suspense fallback={null}>
          <MeetingModal
            isOpen={meetingModalOpen}
            onClose={() => {
              setMeetingModalOpen(false);
              setPendingMove(null);
              setLeads(current => [...current]); // Force render to reset stuck drag-and-drop visuals
            }}
            onSuccess={(email) => {
              if (pendingMove) {
                executeStageMove(pendingMove.leadId, pendingMove.newStage, pendingMove.newStageLabel);
                
                if (email) {
                  setLeads(current => current.map(l => 
                    l.id === pendingMove.leadId ? { ...l, email } : l
                  ));
                }
                setPendingMove(null);
              }
            }}
            contactId={meetingContact.id}
            contactName={meetingContact.name}
            defaultEmail={meetingContact.email}
          />
        </Suspense>
      )}

      {/* === MODAL: CRIAR LEAD === */}
      {isCreateLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
            <header className="px-6 py-4 border-b border-white/5 bg-[#121214] flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2 text-zinc-100">
                <Plus className="w-5 h-5 text-emerald-500" /> Criar Novo Lead
              </h3>
              <button 
                onClick={() => setIsCreateLeadModalOpen(false)}
                className="p-1 text-zinc-500 hover:bg-white/5 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleCreateLeadSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Nome do Lead *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Arthur Fava"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200 placeholder:text-zinc-600"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Telefone (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 5511999999999"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200 placeholder:text-zinc-600"
                  />
                  <p className="text-[9px] text-zinc-550 mt-1">Inclua DDI (55) + DDD + número (somente números).</p>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">E-mail</label>
                  <input
                    type="email"
                    placeholder="Ex: lead@exemplo.com"
                    value={newLeadEmail}
                    onChange={(e) => setNewLeadEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200 placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Empresa</label>
                  <input
                    type="text"
                    placeholder="Ex: Minha Empresa"
                    value={newLeadCompany}
                    onChange={(e) => setNewLeadCompany(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200 placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Origem</label>
                  <select
                    value={newLeadOrigin}
                    onChange={(e) => setNewLeadOrigin(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                  >
                    <option value="">Não informada</option>
                    {leadOrigins.map((o) => (
                      <option key={o.id} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Produto de Interesse</label>
                  <select
                    value={newLeadProduct}
                    onChange={(e) => setNewLeadProduct(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                  >
                    <option value="">Nenhum</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Temperatura</label>
                  <select
                    value={newLeadTemp}
                    onChange={(e) => setNewLeadTemp(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                  >
                    <option value="COLD">COLD (Frio)</option>
                    <option value="WARM">WARM (Morno)</option>
                    <option value="HOT">HOT (Quente)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Estágio Inicial</label>
                  <select
                    value={newLeadStage}
                    onChange={(e) => setNewLeadStage(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                  >
                    {activeStages.map((s) => (
                      <option key={s.id} value={s.title}>{s.title}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5 block">Responsável</label>
                  <select
                    value={newLeadAssignedUser}
                    onChange={(e) => setNewLeadAssignedUser(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-all text-zinc-200"
                  >
                    <option value="">Atribuir a mim</option>
                    {organizationUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateLeadModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLead}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmittingLead ? "Criando Lead..." : "Criar Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
