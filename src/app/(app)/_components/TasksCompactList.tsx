"use client";

import { type TaskData } from "@/actions/crm";
import { CheckCircle2, Circle, Clock, Calendar, AlertTriangle } from "lucide-react";
import { isOverdue, formatTaskDate } from "@/lib/task-utils";

const typeLabels: Record<string, string> = {
  CALL: "Ligação",
  FOLLOW_UP: "Follow-up",
  PROPOSAL: "Proposta",
  MEETING: "Reunião",
  OTHER: "Outra",
};

const priorityColors: Record<string, string> = {
  URGENT: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  LOW: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  onReschedule,
}: {
  task: TaskData;
  onToggle: (id: string, status: string) => void;
  onEdit: (task: TaskData) => void;
  onDelete: (task: TaskData) => void;
  onReschedule: (id: string, dueAt: string | null) => void;
}) {
  const isDone = task.status === "DONE";

  return (
    <div 
      onClick={() => onEdit(task)}
      className={`group flex items-center gap-3 border-b border-white/5 px-4 py-2.5 transition-colors hover:bg-white/[0.04] cursor-pointer ${isDone ? "opacity-50" : ""}`}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.status); }} 
        className="shrink-0 text-zinc-500 transition-colors hover:text-emerald-400"
      >
        {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
      </button>

      <span className={`min-w-0 flex-1 truncate text-sm ${isDone ? "text-zinc-600 line-through" : "text-zinc-200"}`}>
        {task.title}
      </span>

      <span className="hidden w-20 shrink-0 text-center text-[11px] text-zinc-500 sm:block">
        {typeLabels[task.type] || task.type}
      </span>

      <span className={`hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase md:block ${priorityColors[task.priority] || priorityColors.LOW}`}>
        {task.priority === "URGENT" ? "Urg" : task.priority === "HIGH" ? "Alta" : task.priority === "MEDIUM" ? "Média" : "Baixa"}
      </span>

      <span className={`hidden shrink-0 whitespace-nowrap text-[11px] md:block ${isOverdue(task.dueAt, task.status) ? "text-red-400" : "text-zinc-500"}`}>
        {task.dueAt ? formatTaskDate(task.dueAt) : "—"}
      </span>

      <span className="hidden w-28 truncate text-right text-[11px] text-zinc-500 lg:block">
        {task.contact || "—"}
      </span>

      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(task); }} 
          className="rounded px-1.5 py-1 text-[11px] text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
        >
          Editar
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(task); }} 
          className="rounded px-1.5 py-1 text-[11px] text-red-500 hover:bg-red-500/10"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

export function TasksCompactList({
  overdueTasks,
  todayTasks,
  upcomingTasks,
  noDateTasks,
  doneTasks,
  onToggle,
  onEdit,
  onDelete,
  onReschedule,
}: {
  overdueTasks: TaskData[];
  todayTasks: TaskData[];
  upcomingTasks: TaskData[];
  noDateTasks: TaskData[];
  doneTasks: TaskData[];
  onToggle: (id: string, status: string) => void;
  onEdit: (task: TaskData) => void;
  onDelete: (task: TaskData) => void;
  onReschedule: (id: string, dueAt: string | null) => void;
}) {
  const sections = [
    { title: "Atrasadas", tasks: overdueTasks, icon: AlertTriangle, color: "text-red-400" },
    { title: "Hoje", tasks: todayTasks, icon: Clock, color: "text-amber-400" },
    { title: "Próximas", tasks: upcomingTasks, icon: Calendar, color: "text-emerald-400" },
    { title: "Sem data", tasks: noDateTasks, icon: Circle, color: "text-zinc-400" },
    { title: "Concluídas", tasks: doneTasks, icon: CheckCircle2, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        if (section.tasks.length === 0) return null;
        const Icon = section.icon;
        return (
          <div key={section.title}>
            <div className="mb-2 flex items-center gap-2 px-4">
              <Icon className={`h-4 w-4 ${section.color}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${section.color}`}>{section.title}</span>
              <span className="text-[11px] text-zinc-600">{section.tasks.length}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="hidden border-b border-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600 md:grid md:grid-cols-[auto_1fr_80px_60px_80px_120px_80px] md:gap-3">
                <span></span>
                <span>Título</span>
                <span className="text-center">Tipo</span>
                <span className="text-center">Prioridade</span>
                <span className="text-center">Prazo</span>
                <span className="text-right">Contato</span>
                <span></span>
              </div>
              {section.tasks.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onReschedule={onReschedule} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
