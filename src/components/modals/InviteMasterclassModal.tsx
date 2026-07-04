"use client";

import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <h3 className="font-bold text-lg flex items-center gap-2 text-amber-500">
            <Sparkles className="w-5 h-5" /> Masterclass Onboarding
          </h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:bg-white/5 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-400">
            Você está convidando <strong className="text-white">{leadName}</strong> para a Masterclass. Preencha o motivo para que o time de relacionamento possa realizar o onboarding adequado.
          </p>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-amber-500/70 font-bold block">
              Motivo do convite <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Cliente fechou o plano premium e precisa de ajuda para escalar o faturamento..."
              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 min-h-[100px] resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !reason.trim()}
            className="px-6 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Confirmar e Enviar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
