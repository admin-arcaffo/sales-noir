"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function InviteMasterclassModal({
  leadId,
  leadName,
  onClose,
  onSuccess,
}: {
  leadId: string;
  leadName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("O motivo do convite é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { inviteToMasterclassAction } = await import("@/actions/crm");
      await inviteToMasterclassAction(leadId, { reason });
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar convite.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Masterclass Onboarding"
      icon={<Sparkles className="h-5 w-5 text-amber-500" />}
      maxWidth="max-w-md"
      headerClassName="bg-amber-500/10"
      contentClassName="space-y-4 p-6"
      footer={(
        <>
          <button onClick={onClose} className="btn-noir-secondary">
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !reason.trim()}
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Confirmar e Enviar"
            )}
          </button>
        </>
      )}
    >
          <p className="text-sm text-zinc-400">
            Você está convidando <strong className="text-white">{leadName}</strong> para a Masterclass. Preencha o motivo para que o time de relacionamento possa realizar o onboarding adequado.
          </p>

          <div className="space-y-1.5">
            <label className="label-field block text-amber-500/70">
              Motivo do convite <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Cliente fechou o plano premium e precisa de ajuda para escalar o faturamento..."
              className="input-noir min-h-[100px] resize-none"
            />
          </div>
    </Modal>
  );
}
