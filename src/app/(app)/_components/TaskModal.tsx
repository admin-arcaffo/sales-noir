"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, FileText, Flag, MessageSquare, Phone, X } from "lucide-react";
import { createTask, updateTask, type TaskData } from "@/actions/crm";
import { useToast } from "@/components/ui/Toast";

type TaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (task: TaskData) => void;
  onUpdated?: (task: TaskData) => void;
  task?: TaskData | null;
  contactId?: string | null;
  contactName?: string;
  contactOptions?: Array<{ id: string; name: string }>;
  assigneeOptions?: Array<{ id: string; name: string }>;
  defaultContactId?: string;
  defaultAssigneeId?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultType?: string;
  defaultPriority?: string;
  defaultDueAt?: string;
  defaultSource?: string;
  defaultConversationId?: string | null;
  defaultAnalysisId?: string | null;
};

const taskTypes = [
  { value: "FOLLOW_UP", label: "Follow-up", icon: MessageSquare },
  { value: "CALL", label: "Ligação", icon: Phone },
  { value: "MEETING", label: "Reunião", icon: CalendarClock },
  { value: "PROPOSAL", label: "Proposta", icon: FileText },
  { value: "OTHER", label: "Outra", icon: CheckCircle2 },
];

const priorities = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

export function TaskModal({
  isOpen,
  onClose,
  onCreated,
  onUpdated,
  task,
  contactId,
  contactName,
  contactOptions = [],
  assigneeOptions = [],
  defaultContactId = "",
  defaultAssigneeId = "",
  defaultTitle = "",
  defaultDescription = "",
  defaultType = "FOLLOW_UP",
  defaultPriority = "MEDIUM",
  defaultDueAt = "",
  defaultSource = "MANUAL",
  defaultConversationId = null,
  defaultAnalysisId = null,
}: TaskModalProps) {
  const { showToast } = useToast();
  const isEditMode = !!task;

  const [title, setTitle] = useState(isEditMode ? task!.title : defaultTitle);
  const [description, setDescription] = useState(isEditMode ? task!.description || "" : defaultDescription);
  const [type, setType] = useState(isEditMode ? task!.type : defaultType);
  const [priority, setPriority] = useState(isEditMode ? task!.priority : defaultPriority);
  const [dueAt, setDueAt] = useState(isEditMode ? task!.dueAt?.slice(0, 16) || "" : defaultDueAt);
  const [status, setStatus] = useState(isEditMode ? task!.status : "PENDING");
  const [selectedContactId, setSelectedContactId] = useState(contactId || (isEditMode ? task!.contactId || "" : defaultContactId));
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setTitle(isEditMode ? task!.title : defaultTitle);
    setDescription(isEditMode ? task!.description || "" : defaultDescription);
    setType(isEditMode ? task!.type : defaultType);
    setPriority(isEditMode ? task!.priority : defaultPriority);
    setDueAt(isEditMode ? task!.dueAt?.slice(0, 16) || "" : defaultDueAt);
    setStatus(isEditMode ? task!.status : "PENDING");
    setSelectedContactId(contactId || (isEditMode ? task!.contactId || "" : defaultContactId));
    setSelectedAssigneeId("");
  }, [contactId, defaultAssigneeId, defaultContactId, defaultDescription, defaultDueAt, defaultPriority, defaultTitle, defaultType, isOpen, isEditMode, task]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isEditMode && !task) return;

    setIsSaving(true);
    try {
      if (isEditMode && task) {
        const updated = await updateTask(task.id, {
          description: description.trim() || null,
          priority,
          dueAt: dueAt || null,
          status,
          ...(selectedAssigneeId ? { userId: selectedAssigneeId } : {}),
        });
        showToast("Tarefa atualizada.", "success");
        onUpdated?.(updated);
      } else {
        if (!title.trim()) {
          showToast("Informe um título para a tarefa.", "error");
          setIsSaving(false);
          return;
        }
        const created = await createTask({
          title,
          description: description.trim() || undefined,
          type,
          priority,
          dueAt: dueAt || undefined,
          contactId: contactId || selectedContactId || null,
          userId: selectedAssigneeId || undefined,
          source: defaultSource,
          conversationId: defaultConversationId || undefined,
          analysisId: defaultAnalysisId || undefined,
        });
        showToast("Tarefa criada com sucesso.", "success");
        onCreated?.(created);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save task:", error);
      showToast("Não foi possível salvar a tarefa.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/5 bg-white/[0.02] p-5">
          <div>
            <div className="flex items-center gap-2 text-zinc-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h3 className="font-bold">{isEditMode ? "Editar tarefa" : "Criar tarefa"}</h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {contactName ? `Vinculada ao contato ${contactName}` : isEditMode ? "Altere os campos desejados." : "Crie uma próxima ação operacional."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!isEditMode && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Título</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Cobrar retorno da proposta"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 focus:border-white/20"
                autoFocus
              />
            </div>
          )}

          {!contactId && !isEditMode && contactOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Contato vinculado</label>
              <select
                value={selectedContactId}
                onChange={(event) => setSelectedContactId(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all focus:border-white/20"
              >
                <option value="">Selecionar contato...</option>
                {contactOptions.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </select>
            </div>
          )}

          {assigneeOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Responsável</label>
              <select
                value={selectedAssigneeId}
                onChange={(event) => setSelectedAssigneeId(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all focus:border-white/20"
              >
                <option value="">{isEditMode ? "Manter atual" : "Eu mesmo"}</option>
                {assigneeOptions.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>{assignee.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isEditMode && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all focus:border-white/20"
                >
                  <option value="PENDING">Pendente</option>
                  <option value="DONE">Concluída</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <Flag className="h-3 w-3" /> Prioridade
              </label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all focus:border-white/20"
              >
                {priorities.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <CalendarClock className="h-3 w-3" /> Prazo
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all focus:border-white/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Descrição</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Contexto, combinado com o lead ou orientação para a próxima ação..."
              className="min-h-24 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-zinc-300 outline-none transition-all placeholder:text-zinc-700 focus:border-white/20"
            />
          </div>
        </div>

        <footer className="flex justify-end gap-3 border-t border-white/5 bg-white/[0.02] p-5">
          <button onClick={onClose} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving || (!isEditMode && !title.trim())}
            className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Salvando..." : isEditMode ? "Salvar alterações" : "Criar tarefa"}
          </button>
        </footer>
      </div>
    </div>
  );
}
