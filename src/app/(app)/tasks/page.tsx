"use client";

import { useEffect, useState, type ComponentType } from "react";
import { CheckCircle2, Clock, Plus, Phone, MessageSquare, FileText } from "lucide-react";
import { createTask, getLeads, getTasks, toggleTaskStatus, type LeadData, type TaskData } from "@/actions/crm";

const typeIcons: Record<string, ComponentType<{ className?: string }>> = {
  CALL: Phone,
  FOLLOW_UP: MessageSquare,
  PROPOSAL: FileText,
  MEETING: Clock,
  OTHER: CheckCircle2,
};

const priorityStyles: Record<string, string> = {
  URGENT: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  MEDIUM: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  LOW: "text-zinc-500 bg-zinc-700/30 border-zinc-600/30",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "FOLLOW_UP",
    priority: "MEDIUM",
    dueAt: "",
    contactId: "",
  });

  useEffect(() => {
    let alive = true;

    Promise.all([getTasks(), getLeads()])
      .then(([taskResult, leadResult]) => {
        if (!alive) {
          return;
        }

        setTasks(taskResult);
        setLeads(leadResult);
      })
      .catch((error) => {
        console.error("Failed to load tasks:", error);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleToggle = async (task: TaskData) => {
    const updated = await toggleTaskStatus(task.id, task.status);
    setTasks((current) => current.map((item) => (
      item.id === task.id
        ? { ...item, status: updated.status, due: item.due }
        : item
    )));
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const created = await createTask({
        title: form.title,
        type: form.type,
        priority: form.priority,
        dueAt: form.dueAt || undefined,
        contactId: form.contactId || null,
      });

      setTasks((current) => [created, ...current]);
      setForm({ title: "", type: "FOLLOW_UP", priority: "MEDIUM", dueAt: "", contactId: "" });
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Tarefas</h1>
            <p className="text-sm text-zinc-500 mt-1">Follow-ups, chamadas e entregas pendentes</p>
          </div>
          <button className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </button>
        </div>

        <div className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-200">Criar tarefa</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Título da tarefa"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600"
            />
            <select
              value={form.contactId}
              onChange={(event) => setForm((current) => ({ ...current, contactId: event.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">Sem contato</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                </option>
              ))}
            </select>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="CALL">Ligação</option>
              <option value="MEETING">Reunião</option>
              <option value="PROPOSAL">Proposta</option>
              <option value="OTHER">Outra</option>
            </select>
            <select
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <button
              onClick={handleCreate}
              disabled={isCreating || !form.title.trim()}
              className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Criando..." : "Adicionar tarefa"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {tasks.map((task) => {
            const Icon = typeIcons[task.type] || CheckCircle2;
            const isDone = task.status === "DONE";

            return (
              <div
                key={task.id}
                className={`bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors cursor-pointer group ${isDone ? 'opacity-50' : ''}`}
              >
                <button
                  onClick={() => handleToggle(task)}
                  className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${isDone ? 'border-emerald-500 bg-emerald-500/20' : 'border-zinc-600 hover:border-zinc-400'}`}
                >
                  {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </button>

                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-zinc-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{task.title}</p>
                  <p className="text-xs text-zinc-500">{task.contact} • {task.due}</p>
                </div>

                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${priorityStyles[task.priority]}`}>
                  {task.priority}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
