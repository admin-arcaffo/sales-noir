"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Users } from "lucide-react";
import {
  backfillContactIdentitiesBatch,
  getDuplicateContactsReport,
  mergeDuplicateContacts,
  type DuplicateContactsReport,
} from "@/actions/crm";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { invalidateChatCache } from "@/lib/chat-cache";

export function DedupeContactsModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [report, setReport] = useState<DuplicateContactsReport | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ processed: number; total: number; created: number; skipped: number } | null>(null);
  const [mergingGroupId, setMergingGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextReport = await getDuplicateContactsReport();
      setReport(nextReport);
      setSelectedPrimary((current) => {
        const next = { ...current };
        for (const group of nextReport.groups) {
          next[group.id] = next[group.id] || group.recommendedPrimaryId;
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar duplicados.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadReport();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackfill = async () => {
    setIsBackfilling(true);
    setBackfillProgress({ processed: 0, total: report?.totalContacts || 0, created: 0, skipped: 0 });
    try {
      let cursor: string | null = null;
      let processed = 0;
      let created = 0;
      let skipped = 0;
      let total = 0;

      do {
        const result = await backfillContactIdentitiesBatch({ cursor, batchSize: 250 });
        cursor = result.nextCursor;
        processed += result.processed;
        created += result.created;
        skipped += result.skipped;
        total = result.total;
        setBackfillProgress({ processed, total, created, skipped });
        if (result.done) break;
      } while (cursor);

      showToast(`${created} identidade(s) criada(s), ${skipped} ignorada(s).`, "success");
      await loadReport();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao migrar identidades.", "error");
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleMerge = async (groupId: string) => {
    const group = report?.groups.find((item) => item.id === groupId);
    if (!group) return;

    const primaryId = selectedPrimary[groupId] || group.recommendedPrimaryId;
    const duplicateIds = group.contacts.map((contact) => contact.id).filter((id) => id !== primaryId);
    if (duplicateIds.length === 0) return;

    const primary = group.contacts.find((contact) => contact.id === primaryId);
    const confirmed = window.confirm(`Mesclar ${duplicateIds.length} contato(s) em "${primary?.name || "contato principal"}"? Esta acao nao pode ser desfeita automaticamente.`);
    if (!confirmed) return;

    setMergingGroupId(groupId);
    try {
      const result = await mergeDuplicateContacts(primaryId, duplicateIds);
      invalidateChatCache();
      showToast(`${result.merged} contato(s) mesclado(s).`, "success");
      onSuccess?.();
      await loadReport();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao mesclar contatos.", "error");
    } finally {
      setMergingGroupId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deduplicacao de contatos"
      description="Relatorio historico, merge manual e migracao de identidades."
      icon={<Users className="h-5 w-5 text-amber-300" />}
      maxWidth="max-w-6xl"
      closeDisabled={isLoading || isBackfilling || Boolean(mergingGroupId)}
      headerClassName="bg-amber-500/10 p-6"
      contentClassName="p-6"
      footer={(
        <button onClick={onClose} disabled={isLoading || isBackfilling || Boolean(mergingGroupId)} className="btn-noir-secondary px-5 py-2.5">
          Fechar
        </button>
      )}
    >
          {isLoading && !report ? (
            <div className="flex h-60 items-center justify-center text-zinc-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando duplicados...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
          ) : report ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-[11px] font-bold uppercase text-amber-300/70">Grupos</p>
                  <p className="mt-1 text-2xl font-bold text-amber-200">{report.totalGroups}</p>
                </div>
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                  <p className="text-[11px] font-bold uppercase text-indigo-300/70">Contatos envolvidos</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-200">{report.totalContacts}</p>
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <p className="text-[11px] font-bold uppercase text-sky-300/70">Backfill pendente</p>
                  <p className="mt-1 text-2xl font-bold text-sky-200">{report.backfillNeeded}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-[11px] font-bold uppercase text-emerald-300/70">Status</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Seguro</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="max-w-2xl text-xs leading-relaxed text-zinc-400">
                  O merge preenche campos vazios, acumula notas/desafios, move produtos, tarefas, reunioes e historico de chat. Se mais de um contato tiver venda fechada, o merge e bloqueado para proteger o financeiro.
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void loadReport()} disabled={isLoading} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-50">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Recarregar
                  </button>
                  <button onClick={() => void handleBackfill()} disabled={isBackfilling} className="flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-50">
                    {isBackfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Migrar identidades
                  </button>
                </div>
              </div>

              {backfillProgress && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-sky-100">
                    <span className="font-bold">Migracao de identidades</span>
                    <span>{Math.min(backfillProgress.processed, backfillProgress.total)} / {backfillProgress.total || "..."} contatos</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all"
                      style={{ width: `${backfillProgress.total ? Math.min(100, (backfillProgress.processed / backfillProgress.total) * 100) : 5}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-sky-100/80">
                    Criadas: {backfillProgress.created} | Ignoradas por ja existirem/conflito: {backfillProgress.skipped}
                  </p>
                </div>
              )}

              {report.groups.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-300" />
                  <p className="font-bold text-emerald-100">Nenhum duplicado encontrado</p>
                  <p className="mt-1 text-sm text-zinc-400">As identidades conhecidas nao apontam conflitos historicos.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {report.groups.map((group) => {
                    const selected = selectedPrimary[group.id] || group.recommendedPrimaryId;
                    const isMerging = mergingGroupId === group.id;
                    const hasClosedDealConflict = group.contacts.reduce((sum, contact) => sum + contact.counts.closedDeals, 0) > 1;

                    return (
                      <div key={group.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-zinc-100">Grupo com {group.contacts.length} contatos</p>
                              {hasClosedDealConflict && (
                                <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-300">
                                  <AlertTriangle className="h-3 w-3" /> Venda duplicada
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">Motivos: {group.reasons.join(", ") || "Identidade compartilhada"}</p>
                          </div>
                          <button
                            onClick={() => void handleMerge(group.id)}
                            disabled={isMerging || hasClosedDealConflict}
                            className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
                          >
                            {isMerging && <Loader2 className="h-4 w-4 animate-spin" />}
                            Mesclar neste principal
                          </button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                          {group.contacts.map((contact) => (
                            <label key={contact.id} className={`cursor-pointer rounded-xl border p-3 transition-colors ${selected === contact.id ? "border-amber-500/40 bg-amber-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  name={`primary-${group.id}`}
                                  checked={selected === contact.id}
                                  onChange={() => setSelectedPrimary((current) => ({ ...current, [group.id]: contact.id }))}
                                  className="mt-1 h-4 w-4 accent-amber-500"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-bold text-zinc-100">{contact.name}</p>
                                    {contact.id === group.recommendedPrimaryId && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Recomendado</span>}
                                    {contact.counts.closedDeals > 0 && <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">Venda</span>}
                                  </div>
                                  <p className="mt-1 text-xs text-zinc-500">{contact.phone} {contact.email ? `- ${contact.email}` : ""}</p>
                                  {contact.company && <p className="mt-1 text-xs text-zinc-500">{contact.company}</p>}
                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                                    <span>Score {contact.score}</span>
                                    <span>Chats {contact.counts.conversations}</span>
                                    <span>Produtos {contact.counts.products}</span>
                                    <span>Tarefas {contact.counts.tasks}</span>
                                    <span>Reunioes {contact.counts.meetings}</span>
                                    <span>IDs {contact.counts.identities}</span>
                                  </div>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
    </Modal>
  );
}
