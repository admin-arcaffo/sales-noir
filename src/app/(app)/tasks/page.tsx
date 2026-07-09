"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Columns3,
  FileText,
  Filter,
  Grid3X3,
  List,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  getContactOptions,
  getCurrentUserInfo,
  getOrganizationUsers,
  getTasks,
  rescheduleTask,
  toggleTaskStatus,
  deleteTask,
  type TaskData,
} from "@/actions/crm";
import { TaskModal } from "@/app/(app)/_components/TaskModal";
import { TasksCompactList } from "@/app/(app)/_components/TasksCompactList";
import { TasksKanban } from "@/app/(app)/_components/TasksKanban";
import { useToast } from "@/components/ui/Toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { isOverdue, isDueToday, isUpcoming } from "@/lib/task-utils";

const typeIcons: Record<string, ComponentType<{ className?: string }>> = {
  CALL: Phone,
  FOLLOW_UP: MessageSquare,
  PROPOSAL: FileText,
  MEETING: Clock,
  OTHER: CheckCircle2,
};

const typeLabels: Record<string, string> = {
  CALL: "Ligação",
  FOLLOW_UP: "Follow-up",
  PROPOSAL: "Proposta",
  MEETING: "Reunião",
  OTHER: "Outra",
};

const priorityStyles: Record<string, string> = {
  URGENT: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  MEDIUM: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  LOW: "text-zinc-500 bg-zinc-700/30 border-zinc-600/30",
};

type OrganizationUser = { id: string; name: string | null; email: string; role: string };

const sourceLabels: Record<string, string> = {
  MANUAL: "Manual",
  AI: "IA",
  PIPELINE_STAGE: "Pipeline",
  MEETING: "Reunião",
};

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const STORAGE_KEY = "tasks:filters";

type FilterState = {
  viewMode: "cards" | "compact" | "kanban";
  searchTerm: string;
  statusFilter: string;
  typeFilter: string;
  priorityFilter: string;
  contactFilter: string;
  productFilter: string;
  stageFilter: string;
  responsibleFilter: string;
};



function defaultFilters(): FilterState {
  return {
    viewMode: "cards",
    searchTerm: "",
    statusFilter: "ALL",
    typeFilter: "ALL",
    priorityFilter: "ALL",
    contactFilter: "ALL",
    productFilter: "ALL",
    stageFilter: "ALL",
    responsibleFilter: "ALL",
  };
}

function saveFilters(f: FilterState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
}

export default function TasksPage() {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; isLead: boolean; phone: string }>>([]);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalContactId, setModalContactId] = useState("");

  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [useCurrentUserAsDefault, setUseCurrentUserAsDefault] = useState(false);

  const [showOverview, setShowOverview] = useState(false);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);

  useEscapeKey(showFilterSidebar, () => setShowFilterSidebar(false));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setFilters((prev) => ({ ...prev, ...JSON.parse(raw) }));
      } else {
        setUseCurrentUserAsDefault(true);
      }
    } catch {
      setUseCurrentUserAsDefault(true);
    }
    setIsHydrated(true);
  }, []);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      saveFilters(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([getTasks(), getContactOptions(), getOrganizationUsers(), getCurrentUserInfo()])
      .then(([taskResult, contactResult, userResult, userInfo]) => {
        if (!alive) return;
        setTasks(taskResult);
        setContacts(contactResult);
        setUsers(userResult);
        if (userInfo) setCurrentUserId(userInfo.id);
      })
      .catch((error) => {
        console.error("Failed to load tasks:", error);
        showToast("Não foi possível carregar as tarefas.", "error");
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => { alive = false; };
  }, [showToast]);

  useEffect(() => {
    if (!currentUserId || !useCurrentUserAsDefault || !isHydrated) return;
    setFilters((prev) => {
      if (prev.responsibleFilter === currentUserId) return prev;
      const next = { ...prev, responsibleFilter: currentUserId };
      saveFilters(next);
      return next;
    });
    setUseCurrentUserAsDefault(false);
  }, [currentUserId, useCurrentUserAsDefault, isHydrated]);

  const handleToggle = async (taskId: string, currentStatus: string) => {
    try {
      const updated = await toggleTaskStatus(taskId, currentStatus);
      setTasks((current) => current.map((item) => (
        item.id === taskId
          ? { ...item, status: updated.status, completedAt: updated.completedAt }
          : item
      )));
    } catch (error) {
      console.error("Failed to update task:", error);
      showToast("Não foi possível atualizar a tarefa.", "error");
    }
  };

  const handleTaskToggle = (task: TaskData) => void handleToggle(task.id, task.status);

  const handleReschedule = async (task: TaskData, dueAt: string) => {
    try {
      const updated = await rescheduleTask(task.id, dueAt || null);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
      showToast("Tarefa reagendada.", "success");
    } catch (error) {
      console.error("Failed to reschedule task:", error);
      showToast("Não foi possível reagendar a tarefa.", "error");
    }
  };

  const handleEdit = (task: TaskData) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleEditSave = (updated: TaskData) => {
    setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTask) return;
    setIsDeleting(true);
    try {
      await deleteTask(deletingTask.id);
      setTasks((current) => current.filter((item) => item.id !== deletingTask.id));
      showToast("Tarefa excluída.", "success");
      setDeletingTask(null);
    } catch (error) {
      console.error("Failed to delete task:", error);
      showToast("Não foi possível excluir a tarefa.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  useKeyboardShortcuts({
    onEscape: () => {
      setDeletingTask(null);
      setIsTaskModalOpen(false);
    },
    onNew: () => setIsTaskModalOpen(true),
    onSearch: () => document.querySelector<HTMLInputElement>('input[placeholder*="Buscar"]')?.focus()
  });

  const openNewTaskModal = () => {
    setEditingTask(null);
    setModalContactId(filters.contactFilter !== "ALL" ? filters.contactFilter : "");
    setIsTaskModalOpen(true);
  };

  const resetFilters = () => {
    const def = defaultFilters();
    setFilters((prev) => {
      const next = { ...def, viewMode: prev.viewMode, responsibleFilter: currentUserId || "ALL" };
      saveFilters(next);
      return next;
    });
  };

  const search = filters.searchTerm.trim().toLowerCase();
  const productOptions = Array.from(new Set(tasks.flatMap((task) => task.contactProductNames))).sort();
  const stageOptions = Array.from(new Set(tasks.map((task) => task.contactStage).filter(Boolean) as string[])).sort();

  const filteredTasks = tasks.filter((task) => {
    if (filters.statusFilter === "OPEN" && task.status === "DONE") return false;
    if (filters.statusFilter === "DONE" && task.status !== "DONE") return false;
    if (filters.typeFilter !== "ALL" && task.type !== filters.typeFilter) return false;
    if (filters.priorityFilter !== "ALL" && task.priority !== filters.priorityFilter) return false;
    if (filters.contactFilter !== "ALL" && task.contactId !== filters.contactFilter) return false;
    if (filters.productFilter === "NONE" && task.contactProductNames.length > 0) return false;
    if (filters.productFilter !== "ALL" && filters.productFilter !== "NONE" && !task.contactProductNames.includes(filters.productFilter)) return false;
    if (filters.stageFilter !== "ALL" && task.contactStage !== filters.stageFilter) return false;
    if (filters.responsibleFilter !== "ALL" && task.ownerId !== filters.responsibleFilter) return false;

    if (!search) return true;
    const haystack = [
      task.title, task.description || "", task.contact, task.contactCompany || "",
      task.contactPhone || "", task.contactStage || "", task.ownerName || "",
      ...task.contactProductNames,
    ].join(" ").toLowerCase();
    return haystack.includes(search);
  });

  const activeTasks = filteredTasks.filter((task) => task.status !== "DONE");
  const overdueTasks = activeTasks.filter((t) => isOverdue(t.dueAt, t.status));
  const remainingAfterOverdue = activeTasks.filter((t) => !isOverdue(t.dueAt, t.status));
  const todayTasks = remainingAfterOverdue.filter((t) => isDueToday(t.dueAt));
  const remainingAfterToday = remainingAfterOverdue.filter((t) => !isDueToday(t.dueAt));
  const upcomingTasks = remainingAfterToday.filter((t) => isUpcoming(t.dueAt, t.status));
  const noDateTasks = remainingAfterToday.filter((t) => !t.dueAt);
  const doneTasks = filteredTasks.filter((task) => task.status === "DONE");
  const defaultResponsibleFilter = currentUserId || "ALL";
  const hasFilters = filters.searchTerm !== ""
    || filters.statusFilter !== "ALL"
    || filters.typeFilter !== "ALL"
    || filters.priorityFilter !== "ALL"
    || filters.contactFilter !== "ALL"
    || filters.productFilter !== "ALL"
    || filters.stageFilter !== "ALL"
    || filters.responsibleFilter !== defaultResponsibleFilter;

  const assigneeOptions = users.map((user) => ({ id: user.id, name: user.name || user.email }));

  const viewModes = [
    { key: "cards", icon: Grid3X3, label: "Cards" },
    { key: "compact", icon: List, label: "Lista" },
    { key: "kanban", icon: Columns3, label: "Kanban" },
  ] as const;

  return (
    <div className="h-full overflow-y-auto bg-[#040406]">
      <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="heading-page">Central de Tarefas</h1>
              <p className="mt-1 text-sm text-zinc-500">Sua fila operacional para não deixar nenhum lead sem próxima ação.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              {viewModes.map((mode) => {
                const Icon = mode.icon;
                const isActive = filters.viewMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    onClick={() => updateFilter("viewMode", mode.key)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isActive ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {mode.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={openNewTaskModal}
              className="btn-noir flex items-center gap-2 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Nova tarefa
            </button>
          </div>
        </header>

        {/* Toggle Overview */}
        <div className="flex items-center pt-2">
           <button 
             onClick={() => setShowOverview(!showOverview)} 
             className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
           >
             {showOverview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
             Resumo Operacional & Indicadores
           </button>
        </div>

        {/* Collapsible Overview */}
        {showOverview && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <KpiCard label="Atrasadas" value={tasks.filter((t) => isOverdue(t.dueAt, t.status)).length} tone="red" icon={AlertTriangle} />
              <KpiCard label="Hoje" value={tasks.filter((task) => task.status !== "DONE" && isDueToday(task.dueAt)).length} tone="amber" icon={Calendar} />
              <KpiCard label="Abertas" value={tasks.filter((task) => task.status !== "DONE").length} tone="emerald" icon={Clock} />
              <KpiCard label="Sem data" value={tasks.filter((task) => task.status !== "DONE" && !task.dueAt).length} tone="zinc" icon={Filter} />
              <KpiCard label="Concluídas" value={tasks.filter((task) => task.status === "DONE").length} tone="blue" icon={CheckCircle2} />
            </div>

            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300">Briefing operacional</h2>
                  <p className="mt-1 text-sm text-emerald-100/70">
                    {tasks.filter((t) => isOverdue(t.dueAt, t.status)).length > 0
                      ? `Comece pelas ${tasks.filter((t) => isOverdue(t.dueAt, t.status)).length} tarefa(s) atrasada(s). Elas são o maior risco comercial agora.`
                      : tasks.filter((task) => task.status !== "DONE" && isDueToday(task.dueAt)).length > 0
                        ? `Seu foco do dia são ${tasks.filter((task) => task.status !== "DONE" && isDueToday(task.dueAt)).length} tarefa(s) com prazo para hoje.`
                        : tasks.filter((task) => task.status !== "DONE" && !task.dueAt).length > 0
                          ? `Há ${tasks.filter((task) => task.status !== "DONE" && !task.dueAt).length} tarefa(s) sem prazo. Defina datas para evitar perda de controle.`
                          : "Operação em dia. Use a pipeline para identificar leads sem próxima ação."}
                  </p>
                </div>
                <button
                  onClick={() => { updateFilter("statusFilter", "OPEN"); updateFilter("searchTerm", ""); }}
                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                >
                  Revisar fila
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Compact Search & Filter Bar */}
        <section className="flex items-center rounded-xl border border-white/10 bg-white/[0.02] p-1 shadow-sm focus-within:border-white/20 focus-within:bg-white/[0.04] transition-all">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              value={filters.searchTerm}
              onChange={(event) => updateFilter("searchTerm", event.target.value)}
              placeholder="Buscar tarefa, contato, produto..."
              className="w-full bg-transparent py-2.5 pl-10 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
          <div className="flex items-center gap-1 border-l border-white/10 pl-2 pr-1">
            <button
              onClick={() => setShowFilterSidebar(true)}
              className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
                hasFilters ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {hasFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
              )}
            </button>
            {hasFilters && (
              <button onClick={resetFilters} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300" title="Limpar filtros">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.03]" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="surface-noir-muted border-dashed p-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="font-semibold text-zinc-300">Nenhuma tarefa encontrada</p>
            <p className="mt-1 text-sm text-zinc-600">Ajuste os filtros ou crie uma nova tarefa para sua operação.</p>
          </div>
        ) : filters.viewMode === "compact" ? (
          <TasksCompactList
            overdueTasks={overdueTasks}
            todayTasks={todayTasks}
            upcomingTasks={upcomingTasks}
            noDateTasks={noDateTasks}
            doneTasks={doneTasks}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={(task) => setDeletingTask(task)}
            onReschedule={(id, dueAt) => {
              const task = tasks.find((t) => t.id === id);
              if (task) void handleReschedule(task, dueAt || "");
            }}
          />
        ) : filters.viewMode === "kanban" ? (
          <TasksKanban
            tasks={filteredTasks}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={(task) => setDeletingTask(task)}
          />
        ) : (
          <div className="space-y-6">
            <TaskSection title="Atrasadas" description="Exigem ação imediata." tasks={overdueTasks} onToggle={handleTaskToggle} onReschedule={handleReschedule} onEdit={handleEdit} onDelete={(task) => setDeletingTask(task)} tone="red" />
            <TaskSection title="Hoje" description="Prioridade do dia." tasks={todayTasks} onToggle={handleTaskToggle} onReschedule={handleReschedule} onEdit={handleEdit} onDelete={(task) => setDeletingTask(task)} tone="amber" />
            <TaskSection title="Próximas" description="Compromissos futuros." tasks={upcomingTasks} onToggle={handleTaskToggle} onReschedule={handleReschedule} onEdit={handleEdit} onDelete={(task) => setDeletingTask(task)} tone="emerald" />
            <TaskSection title="Sem data" description="Ações abertas que precisam de prazo." tasks={noDateTasks} onToggle={handleTaskToggle} onReschedule={handleReschedule} onEdit={handleEdit} onDelete={(task) => setDeletingTask(task)} tone="zinc" />
            <TaskSection title="Concluídas" description="Histórico recente filtrado." tasks={doneTasks} onToggle={handleTaskToggle} onReschedule={handleReschedule} onEdit={handleEdit} onDelete={(task) => setDeletingTask(task)} tone="blue" initiallyCompact />
          </div>
        )}

        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
          onCreated={(task) => setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)])}
          onUpdated={handleEditSave}
          task={editingTask}
          contactOptions={contacts.map((contact) => ({ id: contact.id, name: contact.name }))}
          assigneeOptions={assigneeOptions}
          defaultContactId={modalContactId}
        />

        {/* --- Painel Lateral (Drawer) de Filtros --- */}
        {showFilterSidebar && (
          <div 
            className="modal-overlay fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowFilterSidebar(false)}
          >
            <div 
              className="flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#0c0c0e] shadow-2xl animate-in slide-in-from-right duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 p-5">
                <h3 className="flex items-center gap-2 font-bold text-zinc-100">
                  <Filter className="h-4 w-4" /> Filtros Avançados
                </h3>
                <button onClick={() => setShowFilterSidebar(false)} className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Status</label>
                  <FilterSelect value={filters.statusFilter} onChange={(v) => updateFilter("statusFilter", v)}>
                    <option value="ALL">Todos os status</option>
                    <option value="OPEN">Abertas</option>
                    <option value="DONE">Concluídas</option>
                  </FilterSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tipo de Tarefa</label>
                  <FilterSelect value={filters.typeFilter} onChange={(v) => updateFilter("typeFilter", v)}>
                    <option value="ALL">Todos os tipos</option>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </FilterSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Prioridade</label>
                  <FilterSelect value={filters.priorityFilter} onChange={(v) => updateFilter("priorityFilter", v)}>
                    <option value="ALL">Todas prioridades</option>
                    <option value="URGENT">Urgente</option>
                    <option value="HIGH">Alta</option>
                    <option value="MEDIUM">Média</option>
                    <option value="LOW">Baixa</option>
                  </FilterSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Contato (Lead)</label>
                  <FilterSelect value={filters.contactFilter} onChange={(v) => updateFilter("contactFilter", v)}>
                    <option value="ALL">Todos os contatos</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>{contact.name}</option>
                    ))}
                  </FilterSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Responsável</label>
                  <FilterSelect value={filters.responsibleFilter} onChange={(v) => updateFilter("responsibleFilter", v)}>
                    <option value="ALL">Todos responsáveis</option>
                    {users.map((user) => {
                      const label = user.name || user.email;
                      return (
                        <option key={user.id} value={user.id}>
                          {user.id === currentUserId ? `Eu (${label})` : label}
                        </option>
                      );
                    })}
                  </FilterSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Produto</label>
                  <FilterSelect value={filters.productFilter} onChange={(v) => updateFilter("productFilter", v)}>
                    <option value="ALL">Todos os produtos</option>
                    <option value="NONE">Sem produto</option>
                    {productOptions.map((product) => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </FilterSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Estágio do Funil</label>
                  <FilterSelect value={filters.stageFilter} onChange={(v) => updateFilter("stageFilter", v)}>
                    <option value="ALL">Todos os estágios</option>
                    {stageOptions.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </FilterSelect>
                </div>
              </div>

              <div className="flex gap-3 border-t border-white/5 bg-white/[0.02] p-5">
                <button
                  onClick={() => { resetFilters(); setShowFilterSidebar(false); }}
                  disabled={!hasFilters}
                  className="btn-noir-secondary flex-1 disabled:opacity-50"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setShowFilterSidebar(false)}
                  className="btn-noir flex-1"
                >
                  Visualizar Resultados
                </button>
              </div>
            </div>
          </div>
        )}

        {deletingTask && (
          <div className="modal-overlay fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c0e] p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100">Excluir tarefa</h3>
                  <p className="mt-0.5 text-sm text-zinc-500">"{deletingTask.title}"</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-zinc-500">Essa ação não pode ser desfeita.</p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setDeletingTask(null)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleDeleteConfirm()}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="select-noir"
    >
      {children}
    </select>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: ComponentType<{ className?: string }>; tone: "red" | "amber" | "emerald" | "zinc" | "blue" }) {
  const tones = {
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    zinc: "text-zinc-400 bg-white/5 border-white/10",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };

  return (
    <div className="surface-noir-muted p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function TaskSection({
  title,
  description,
  tasks,
  tone,
  initiallyCompact = false,
  onToggle,
  onReschedule,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  tasks: TaskData[];
  tone: "red" | "amber" | "emerald" | "zinc" | "blue";
  initiallyCompact?: boolean;
  onToggle: (task: TaskData) => void;
  onReschedule: (task: TaskData, dueAt: string) => void;
  onEdit: (task: TaskData) => void;
  onDelete: (task: TaskData) => void;
}) {
  if (tasks.length === 0) return null;

  const visibleTasks = initiallyCompact ? tasks.slice(0, 8) : tasks;
  const toneClasses = {
    red: "bg-red-500", amber: "bg-amber-500", emerald: "bg-emerald-500",
    zinc: "bg-zinc-500", blue: "bg-blue-500",
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${toneClasses[tone]}`} />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">{title}</h2>
            <p className="text-xs text-zinc-600">{description}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-500">{tasks.length}</span>
      </div>

      <div className="grid gap-3">
        {visibleTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={() => onToggle(task)}
            onReschedule={(dueAt) => onReschedule(task, dueAt)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
          />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  onToggle,
  onReschedule,
  onEdit,
  onDelete,
}: {
  task: TaskData;
  onToggle: () => void;
  onReschedule: (dueAt: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = typeIcons[task.type] || CheckCircle2;
  const isDone = task.status === "DONE";
  const chatHref = task.conversationId ? `/conversations?conversationId=${task.conversationId}` : `/conversations?contactId=${task.contactId}`;

  return (
    <div 
      onClick={onEdit}
      className={`group surface-noir-muted p-4 transition-colors hover:border-white/10 cursor-pointer ${isDone ? "opacity-55" : ""}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-1 items-start gap-4 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              isDone ? "border-emerald-500 bg-emerald-500/20" : "border-zinc-600 hover:border-zinc-300"
            }`}
            title={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
          >
            {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-500">
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-sm font-bold ${isDone ? "text-zinc-500 line-through" : "text-zinc-100"}`}>{task.title}</p>
              <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityStyles[task.priority] || priorityStyles.MEDIUM}`}>
                {task.priority}
              </span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                {typeLabels[task.type] || task.type}
              </span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                {sourceLabels[task.source] || task.source}
              </span>
            </div>

            {task.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">{task.description}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1 rounded-md bg-white/[0.03] px-2 py-1">
                <Calendar className="h-3.5 w-3.5" />
                {task.due}
              </span>
              {!isDone && (
                <input
                  type="datetime-local"
                  defaultValue={formatDateTimeLocal(task.dueAt)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(event) => {
                    const current = formatDateTimeLocal(task.dueAt);
                    if (event.target.value !== current) onReschedule(event.target.value);
                  }}
                  className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-500 outline-none transition-colors focus:border-white/20"
                  title="Reagendar tarefa"
                />
              )}
              <span className="flex items-center gap-1 rounded-md bg-white/[0.03] px-2 py-1">
                <User className="h-3.5 w-3.5" />
                {task.contact}
              </span>
              {task.ownerName && (
                <span className="rounded-md bg-white/[0.03] px-2 py-1">
                  Resp: {task.ownerName}
                </span>
              )}
              {task.contactStage && (
                <span className="flex items-center gap-1 rounded-md bg-white/[0.03] px-2 py-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {task.contactStage}
                </span>
              )}
              {task.contactProductNames.length > 0 && (
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-400">
                  {task.contactProductNames.slice(0, 2).join(", ")}{task.contactProductNames.length > 2 ? " +" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
          >
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-red-400 opacity-0 transition-all hover:bg-red-500/10 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {task.contactId && (
            <Link
              href={chatHref}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </Link>
          )}
          {task.contactId && task.isLead && (
            <Link
              href={`/leads?leadId=${task.contactId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              Pipeline
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
