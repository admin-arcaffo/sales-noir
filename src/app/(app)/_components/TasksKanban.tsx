"use client";

import { type TaskData } from "@/actions/crm";
import { CheckCircle2, Circle, Flag } from "lucide-react";
import { isOverdue, formatTaskDate } from "@/lib/task-utils";

const priorityConfig = [
  { key: "URGENT", label: "Urgente", color: "border-red-500/30 bg-red-500/[0.04]", headerColor: "text-red-400 bg-red-500/10" },
  { key: "HIGH", label: "Alta", color: "border-orange-500/30 bg-orange-500/[0.04]", headerColor: "text-orange-400 bg-orange-500/10" },
  { key: "MEDIUM", label: "Média", color: "border-yellow-500/30 bg-yellow-500/[0.04]", headerColor: "text-yellow-400 bg-yellow-500/10" },
  { key: "LOW", label: "Baixa", color: "border-zinc-500/30 bg-zinc-500/[0.04]", headerColor: "text-zinc-400 bg-zinc-500/10" },
];

const typeLabels: Record<string, string> = {
  CALL: "Ligação",
  FOLLOW_UP: "Follow-up",
  PROPOSAL: "Proposta",
  MEETING: "Reunião",
  OTHER: "Outra",
};

function KanbanCard({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TaskData;
  onToggle: (id: string, status: string) => void;
  onEdit: (task: TaskData) => void;
  onDelete: (task: TaskData) => void;
}) {
  const isDone = task.status === "DONE";

  return (
    <div 
      onClick={() => onEdit(task)}
      className={`group rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-all hover:border-white/20 hover:bg-white/[0.06] cursor-pointer ${isDone ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.status); }} 
          className="mt-0.5 shrink-0 text-zinc-500 transition-colors hover:text-emerald-400"
        >
          {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${isDone ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{task.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{typeLabels[task.type] || task.type}</span>
            {task.dueAt && (
              <span className={`text-[10px] ${isOverdue(task.dueAt, task.status) ? "text-red-400" : "text-zinc-600"}`}>
                {formatTaskDate(task.dueAt)}
              </span>
            )}
          </div>
          {task.contact && (
            <p className="mt-1 truncate text-[11px] text-zinc-600">{task.contact}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(task); }} 
            className="rounded px-1.5 py-1 text-[10px] text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
          >
            Editar
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(task); }} 
            className="rounded px-1.5 py-1 text-[10px] text-red-500 hover:bg-red-500/10"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

export function TasksKanban({
  tasks,
  onToggle,
  onEdit,
  onDelete,
}: {
  tasks: TaskData[];
  onToggle: (id: string, status: string) => void;
  onEdit: (task: TaskData) => void;
  onDelete: (task: TaskData) => void;
}) {
  const activeTasks = tasks.filter((t) => t.status !== "DONE");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {priorityConfig.map((col) => {
        const colTasks = activeTasks.filter((t) => t.priority === col.key);
        if (colTasks.length === 0) return null;

        return (
          <div key={col.key} className={`flex flex-col gap-2 rounded-xl border p-3 ${col.color}`}>
            <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${col.headerColor}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <Flag className="h-3 w-3" />
                {col.label}
              </div>
              <span className="text-[11px] opacity-70">{colTasks.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {colTasks.map((task) => (
                <KanbanCard key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })}
      {activeTasks.length === 0 && (
        <div className="col-span-full py-12 text-center text-sm text-zinc-600">
          Nenhuma tarefa pendente.
        </div>
      )}
    </div>
  );
}
