"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

type ProductSnapshot = {
  productId: string | null;
  name: string;
  price: number | null;
};

type ExistingDeal = {
  installmentCount: number | null;
  firstPaymentValue: number | null;
  firstPaymentDate: number | null;
  projectDuration: string | null;
  paymentMethod: string | null;
  hasSignal: boolean;
  signalValue: number | null;
  notes: string | null;
  closedAt: string;
};

const inputClass = "input-noir disabled:opacity-60";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ClosedDealModal({
  leadId,
  leadName,
  targetStage,
  onClose,
  onSuccess,
}: {
  leadId: string;
  leadName: string;
  targetStage: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [products, setProducts] = useState<ProductSnapshot[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [existingDeal, setExistingDeal] = useState<ExistingDeal | null>(null);
  const [installmentCount, setInstallmentCount] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [projectDuration, setProjectDuration] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [hasSignal, setHasSignal] = useState(false);
  const [signalValue, setSignalValue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError(null);

    import("@/actions/crm")
      .then(({ getClosedDealFormData }) => getClosedDealFormData(leadId))
      .then((data) => {
        if (!alive) return;

        const deal = data.existingDeal;
        setProducts(data.products);
        setTotalValue(data.totalValue);
        setExistingDeal(deal);

        if (deal) {
          setInstallmentCount(deal.installmentCount ? String(deal.installmentCount) : "");
          setFirstPaymentDate(deal.firstPaymentDate ? String(deal.firstPaymentDate) : "");
          setProjectDuration(deal.projectDuration || "");
          setPaymentMethod(deal.paymentMethod || "PIX");
          setHasSignal(deal.hasSignal);
          setSignalValue(deal.signalValue !== null ? String(deal.signalValue) : "");
          setNotes(deal.notes || "");
        } else {
          setInstallmentCount("");
          setFirstPaymentDate("");
          setProjectDuration("");
          setPaymentMethod("PIX");
          setHasSignal(false);
          setSignalValue("");
          setNotes("");
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (alive) setError("Erro ao carregar os dados da venda.");
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [leadId]);

  const handleSubmit = async () => {
    setError(null);

    if (!installmentCount || Number(installmentCount) < 1) {
      setError("Informe a quantidade de parcelas.");
      return;
    }

    const paymentDay = Number(firstPaymentDate);
    if (!firstPaymentDate || !Number.isFinite(paymentDay) || paymentDay < 1 || paymentDay > 31) {
      setError("Informe o melhor dia para vencimento (1 a 31).");
      return;
    }

    if (!projectDuration.trim()) {
      setError("Informe o tempo de projeto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { dispatchClosedDeal } = await import("@/actions/crm");
      await dispatchClosedDeal(leadId, {
        targetStage,
        installmentCount: Math.floor(Number(installmentCount)),
        firstPaymentDate: paymentDay,
        projectDuration,
        paymentMethod,
        hasSignal,
        signalValue: hasSignal ? parseNumber(signalValue) : null,
        notes,
      });
      onSuccess();
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Erro ao despachar a venda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Negocio Fechado"
      description="Despache a venda para financeiro e entrega."
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
      maxWidth="max-w-2xl"
      closeDisabled={isSubmitting}
      headerClassName="bg-emerald-500/10 p-6"
      contentClassName="space-y-5 p-6"
      footerClassName="flex-col md:flex-row md:items-center md:justify-between"
      footer={(
        <>
          <div className="min-h-[20px] text-xs text-red-300">
            {error && <span>{error}</span>}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} disabled={isSubmitting} className="btn-noir-secondary px-5 py-2.5">
              Cancelar
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || isLoading}
              className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Despachando...
                </>
              ) : existingDeal ? "Atualizar Despacho" : "Despachar Venda"}
            </button>
          </div>
        </>
      )}
    >
          <p className="text-sm text-zinc-400">
            Complete as informacoes de fechamento de <strong className="text-white">{leadName}</strong>.
          </p>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Carregando dados da venda...</span>
            </div>
          ) : (
            <>
              {existingDeal && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  Venda ja despachada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(existingDeal.closedAt))}. Voce pode atualizar os dados abaixo.
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Valor Total
                  </label>
                  <input value={formatCurrency(totalValue)} disabled className={inputClass} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Forma de Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className={inputClass}
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartao de Credito">Cartao de Credito</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Produtos Vendidos</label>
                <div className="rounded-xl border border-zinc-800 bg-black/30 divide-y divide-zinc-900 overflow-hidden">
                  {products.length > 0 ? products.map((product, index) => (
                    <div key={`${product.productId || product.name}-${index}`} className="px-3 py-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-300 truncate">{product.name}</span>
                      <span className="text-xs font-mono text-emerald-400 whitespace-nowrap">{formatCurrency(product.price)}</span>
                    </div>
                  )) : (
                    <div className="px-3 py-3 text-xs text-zinc-500">Nenhum produto associado ao card.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Quantidade de Parcelas</label>
                  <input
                    type="number"
                    min={1}
                    value={installmentCount}
                    onChange={(event) => setInstallmentCount(event.target.value)}
                    placeholder="Ex: 6"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Melhor Dia para Vencimento</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={firstPaymentDate}
                    onChange={(event) => setFirstPaymentDate(event.target.value)}
                    placeholder="Ex: 15"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Pagou sinal?</label>
                  <div className="flex gap-4 h-[38px] items-center">
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="radio" checked={hasSignal} onChange={() => setHasSignal(true)} className="accent-emerald-500" />
                      Sim
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="radio" checked={!hasSignal} onChange={() => setHasSignal(false)} className="accent-emerald-500" />
                      Nao
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Valor do Sinal</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={signalValue}
                    onChange={(event) => setSignalValue(event.target.value)}
                    disabled={!hasSignal}
                    placeholder="Ex: 500"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Tempo de Projeto</label>
                <input
                  value={projectDuration}
                  onChange={(event) => setProjectDuration(event.target.value)}
                  placeholder="Ex: 3 meses"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Observacoes da Venda</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Detalhes adicionais, combinados de entrega, observacoes financeiras, etc."
                  className="input-noir min-h-[90px] resize-none"
                />
              </div>
            </>
          )}
    </Modal>
  );
}
