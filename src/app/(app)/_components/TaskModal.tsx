"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, FileText, Flag, MessageSquare, Phone } from "lucide-react";
import { createTask, updateTask, type TaskData } from "@/actions/crm";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Editar tarefa" : "Criar tarefa"}
      description={contactName ? `Vinculada ao contato ${contactName}` : isEditMode ? "Altere os campos desejados." : "Crie uma próxima ação operacional."}
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
      maxWidth="max-w-lg"
      contentClassName="space-y-4"
      footer={(
        <>
          <button onClick={onClose} className="btn-noir-secondary">
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving || (!isEditMode && !title.trim())}
            className="btn-noir rounded-lg px-5 py-2 text-sm"
          >
            {isSaving ? "Salvando..." : isEditMode ? "Salvar alterações" : "Criar tarefa"}
          </button>
        </>
      )}
    >
          {!isEditMode && (
            <div className="space-y-1.5">
              <label className="label-field">Título</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Cobrar retorno da proposta"
                className="input-noir"
                autoFocus
              />
            </div>
          )}

          {!contactId && !isEditMode && contactOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="label-field">Contato vinculado</label>
              <select
                value={selectedContactId}
                onChange={(event) => setSelectedContactId(event.target.value)}
                className="select-noir"
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
              <label className="label-field">Responsável</label>
              <select
                value={selectedAssigneeId}
                onChange={(event) => setSelectedAssigneeId(event.target.value)}
                className="select-noir"
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
                <label className="label-field">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="select-noir"
                >
                  <option value="PENDING">Pendente</option>
                  <option value="DONE">Concluída</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="label-field flex items-center gap-1">
                <Flag className="h-3 w-3" /> Prioridade
              </label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="select-noir"
              >
                {priorities.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="label-field flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Prazo
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="input-noir"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="label-field">Descrição</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Contexto, combinado com o lead ou orientação para a próxima ação..."
              className="input-noir min-h-24 resize-none rounded-xl bg-white/[0.03] p-3 leading-relaxed text-zinc-300 placeholder:text-zinc-700"
            />
          </div>
    </Modal>
  );
}
