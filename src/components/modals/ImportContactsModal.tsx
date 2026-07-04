"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, RotateCw, Upload } from "lucide-react";
import {
  importContactsFromFile,
  previewContactsImport,
  type ContactImportField,
  type ContactImportMapping,
  type ContactImportPreview,
  type ContactImportResult,
} from "@/actions/crm";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { invalidateChatCache } from "@/lib/chat-cache";

type WizardStep = "upload" | "map" | "confirm" | "result";

const fieldOptions: Array<{ value: ContactImportField | ""; label: string }> = [
  { value: "", label: "Ignorar" },
  { value: "name", label: "Nome" },
  { value: "phone", label: "Telefone" },
  { value: "company", label: "Empresa" },
  { value: "email", label: "Email" },
  { value: "interestArea", label: "Area de interesse" },
  { value: "origin", label: "Origem" },
  { value: "notes", label: "Observacoes" },
  { value: "potentialValue", label: "Potencial" },
  { value: "address", label: "Endereco" },
  { value: "monthlyRevenue", label: "Faturamento mensal" },
  { value: "mainChallenges", label: "Principais desafios" },
  { value: "products", label: "Produtos" },
  { value: "assignedUser", label: "Responsavel" },
];

const fieldLabels = Object.fromEntries(fieldOptions.filter((item) => item.value).map((item) => [item.value, item.label])) as Record<ContactImportField, string>;

function statusLabel(status: ContactImportPreview["rows"][number]["status"]) {
  if (status === "create") return "Novo";
  if (status === "update") return "Atualizar";
  if (status === "merge") return "Conciliar";
  return "Erro";
}

function statusClass(status: ContactImportPreview["rows"][number]["status"]) {
  if (status === "create") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "update") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (status === "merge") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function resultStatusLabel(status: ContactImportResult["rows"][number]["status"]) {
  if (status === "created") return "Criado";
  if (status === "updated") return "Atualizado";
  if (status === "merged") return "Conciliado";
  if (status === "skipped") return "Ignorado";
  return "Erro";
}

export function ImportContactsModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<WizardStep>("upload");
  const [mappings, setMappings] = useState<ContactImportMapping>({});
  const [preview, setPreview] = useState<ContactImportPreview | null>(null);
  const [includedLines, setIncludedLines] = useState<number[]>([]);
  const [result, setResult] = useState<ContactImportResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewStale, setIsPreviewStale] = useState(false);

  if (!isOpen) return null;

  const validRows = preview?.rows.filter((row) => row.status !== "error") || [];
  const selectedCount = validRows.filter((row) => includedLines.includes(row.line)).length;

  const runPreview = async (targetFile = file, targetMappings?: ContactImportMapping) => {
    if (!targetFile) return;
    setIsPreviewing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", targetFile);
      if (targetMappings) formData.append("mappings", JSON.stringify(targetMappings));

      const nextPreview = await previewContactsImport(formData);
      setPreview(nextPreview);
      setMappings(nextPreview.mappings);
      setIncludedLines(nextPreview.rows.filter((row) => row.status !== "error").map((row) => row.line));
      setIsPreviewStale(false);
      setStep("map");
    } catch (error) {
      console.error("Import preview failed:", error);
      showToast(error instanceof Error ? error.message : "Erro ao ler a planilha.", "error");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      showToast("Formato nao suportado. Use .xlsx, .xls ou .csv.", "error");
      return;
    }

    setFile(selected);
    setPreview(null);
    setResult(null);
    setMappings({});
    setIncludedLines([]);
    void runPreview(selected);
  };

  const handleMappingChange = (header: string, field: ContactImportField | "") => {
    setMappings((prev) => ({ ...prev, [header]: field }));
    setIsPreviewStale(true);
  };

  const toggleLine = (line: number) => {
    setIncludedLines((prev) => prev.includes(line) ? prev.filter((item) => item !== line) : [...prev, line]);
  };

  const handleSubmit = async () => {
    if (!file || !preview) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mappings", JSON.stringify(mappings));
      formData.append("includedLines", JSON.stringify(includedLines));

      const res = await importContactsFromFile(formData);
      setResult(res);
      setStep("result");
      invalidateChatCache();
      onSuccess?.();
      showToast(`${res.created} criado(s), ${res.updated} atualizado(s), ${res.merged} conciliado(s).`, "success");
    } catch (error) {
      console.error("Import failed:", error);
      showToast(error instanceof Error ? error.message : "Erro ao importar.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || isPreviewing) return;
    setFile(null);
    setStep("upload");
    setMappings({});
    setPreview(null);
    setIncludedLines([]);
    setResult(null);
    setIsPreviewStale(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importar Contatos"
      description="Preview, mapeamento, conciliacao e confirmacao antes de gravar."
      icon={<FileSpreadsheet className="h-5 w-5 text-indigo-300" />}
      maxWidth="max-w-6xl"
      closeDisabled={isSubmitting || isPreviewing}
      headerClassName="bg-indigo-500/10 p-6"
      contentClassName="p-0"
      footer={(
        <>
          <button onClick={handleClose} disabled={isSubmitting || isPreviewing} className="btn-noir-secondary px-5 py-2.5">
            {step === "result" ? "Fechar" : "Cancelar"}
          </button>

          {step === "upload" && (
            <button onClick={() => fileInputRef.current?.click()} disabled={isPreviewing} className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:opacity-60">
              {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Selecionar arquivo
            </button>
          )}

          {step === "map" && preview && (
            <button onClick={() => setStep("confirm")} disabled={isPreviewStale || isPreviewing || validRows.length === 0} className="rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50">
              Continuar
            </button>
          )}

          {step === "confirm" && preview && (
            <>
              <button onClick={() => setStep("map")} disabled={isSubmitting} className="btn-noir-secondary px-5 py-2.5">Voltar</button>
              <button onClick={() => void handleSubmit()} disabled={selectedCount === 0 || isSubmitting} className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:opacity-60">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {selectedCount} linha(s)
              </button>
            </>
          )}
        </>
      )}
    >
        <div className="border-b border-white/5 px-6 py-3">
          <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            {["Upload", "Mapeamento", "Confirmacao", "Resultado"].map((label, index) => {
              const current = ["upload", "map", "confirm", "result"].indexOf(step);
              return (
                <span key={label} className={`rounded-full border px-3 py-1 ${index <= current ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300" : "border-white/10 bg-white/[0.03]"}`}>
                  {index + 1}. {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {step === "upload" && (
            <div className="mx-auto max-w-xl space-y-5">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 p-10 text-center transition-colors hover:border-indigo-500/50"
              >
                {isPreviewing ? (
                  <div className="flex flex-col items-center gap-3 text-zinc-300">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                    <p className="text-sm font-semibold">Lendo planilha...</p>
                  </div>
                ) : file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-7 w-7 text-indigo-400" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-zinc-200">{file.name}</p>
                      <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-3 h-9 w-9 text-zinc-500" />
                    <p className="text-sm font-semibold text-zinc-300">Clique para selecionar um arquivo</p>
                    <p className="mt-1 text-xs text-zinc-600">.xlsx, .xls ou .csv</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-xs leading-relaxed text-zinc-400">
                <p className="mb-1 font-semibold text-zinc-300">Colunas reconhecidas automaticamente:</p>
                <p>nome, telefone, empresa, email, area_interesse, origem, observacoes, potencial, endereco, faturamento_mensal, principais_desafios, produtos, responsavel</p>
              </div>
            </div>
          )}

          {step === "map" && preview && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-[11px] font-bold uppercase text-emerald-300/70">Novos</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-200">{preview.summary.create}</p>
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                  <p className="text-[11px] font-bold uppercase text-sky-300/70">Atualizar</p>
                  <p className="mt-1 text-2xl font-bold text-sky-200">{preview.summary.update}</p>
                </div>
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3">
                  <p className="text-[11px] font-bold uppercase text-indigo-300/70">Conciliar</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-200">{preview.summary.merge}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-[11px] font-bold uppercase text-amber-300/70">Conflitos</p>
                  <p className="mt-1 text-2xl font-bold text-amber-200">{preview.summary.conflicts}</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-[11px] font-bold uppercase text-red-300/70">Erros</p>
                  <p className="mt-1 text-2xl font-bold text-red-200">{preview.summary.errors}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-zinc-200">Mapeamento de colunas</p>
                    <p className="text-xs text-zinc-500">Ajuste qualquer coluna antes de atualizar a previa.</p>
                  </div>
                  <button
                    onClick={() => void runPreview(file, mappings)}
                    disabled={isPreviewing}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                    Atualizar previa
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {preview.headers.map((header) => (
                    <label key={header} className="space-y-1">
                      <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{header}</span>
                      <select
                        value={mappings[header] || ""}
                        onChange={(e) => handleMappingChange(header, e.target.value as ContactImportField | "")}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
                      >
                        {fieldOptions.map((option) => (
                          <option key={option.value || "ignore"} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {isPreviewStale && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                  O mapeamento mudou. Atualize a previa antes de continuar.
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="sticky top-0 bg-[#121216] text-[11px] uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Linha</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Telefone</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Contato encontrado</th>
                        <th className="px-3 py-2">Alertas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {preview.rows.map((row) => (
                        <tr key={row.line} className="bg-black/10">
                          <td className="px-3 py-2 text-zinc-500">{row.line}</td>
                          <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                          <td className="px-3 py-2">{row.values.name || "-"}</td>
                          <td className="px-3 py-2">{row.values.phone || "-"}</td>
                          <td className="px-3 py-2">{row.values.email || "-"}</td>
                          <td className="px-3 py-2 text-zinc-400">{row.existingContact ? `${row.existingContact.name} (${row.existingContact.phone})` : "-"}</td>
                          <td className="px-3 py-2 text-zinc-500">
                            {row.errors.length > 0 ? row.errors.join(" ") : row.conflicts.length > 0 ? `${row.conflicts.length} conflito(s)` : row.changedFields.length > 0 ? `Campos: ${row.changedFields.join(", ")}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === "confirm" && preview && (
            <div className="space-y-5">
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                <p className="text-sm font-bold text-indigo-200">Confirmacao de importacao</p>
                <p className="mt-1 text-xs text-zinc-400">{selectedCount} de {validRows.length} linha(s) validas selecionadas. Linhas com erro nao serao aplicadas.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setIncludedLines(validRows.map((row) => row.line))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10">Selecionar validas</button>
                <button onClick={() => setIncludedLines(validRows.filter((row) => row.conflicts.length === 0).map((row) => row.line))} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20">Desmarcar conflitos</button>
                <button onClick={() => setIncludedLines([])} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10">Desmarcar tudo</button>
              </div>

              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {preview.rows.map((row) => {
                  const disabled = row.status === "error";
                  const checked = includedLines.includes(row.line);
                  return (
                    <div key={row.line} className={`rounded-xl border p-3 ${disabled ? "border-red-500/20 bg-red-500/5" : checked ? "border-indigo-500/30 bg-indigo-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <label className="flex min-w-0 flex-1 items-start gap-3">
                          <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleLine(row.line)} className="mt-1 h-4 w-4 accent-indigo-500 disabled:opacity-40" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-zinc-500">Linha {row.line}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                              {row.conflicts.length > 0 && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">Conflito</span>}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-zinc-200">{row.values.name || "Sem nome"} <span className="text-zinc-500">{row.values.phone || "sem telefone"}</span></p>
                            {row.existingContact && <p className="mt-1 text-xs text-zinc-500">Existente: {row.existingContact.name} ({row.existingContact.phone})</p>}
                          </div>
                        </label>
                        <div className="text-xs text-zinc-500 md:max-w-md">
                          {row.errors.length > 0 && <p className="text-red-300">{row.errors.join(" ")}</p>}
                          {row.conflicts.map((conflict, index) => (
                            <p key={`${conflict.field}-${index}`} className="text-amber-200/80">
                              {fieldLabels[conflict.field as ContactImportField] || conflict.field}: atual "{conflict.existing}" / planilha "{conflict.incoming}"
                            </p>
                          ))}
                          {row.conflicts.length === 0 && row.changedFields.length > 0 && <p>Preenche: {row.changedFields.join(", ")}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-6">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"><p className="text-[11px] font-bold uppercase text-emerald-300/70">Criados</p><p className="mt-1 text-2xl font-bold text-emerald-200">{result.created}</p></div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3"><p className="text-[11px] font-bold uppercase text-sky-300/70">Atualizados</p><p className="mt-1 text-2xl font-bold text-sky-200">{result.updated}</p></div>
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3"><p className="text-[11px] font-bold uppercase text-indigo-300/70">Conciliados</p><p className="mt-1 text-2xl font-bold text-indigo-200">{result.merged}</p></div>
                <div className="rounded-xl border border-zinc-700 bg-white/[0.03] p-3"><p className="text-[11px] font-bold uppercase text-zinc-500">Ignorados</p><p className="mt-1 text-2xl font-bold text-zinc-200">{result.skipped}</p></div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"><p className="text-[11px] font-bold uppercase text-amber-300/70">Conflitos</p><p className="mt-1 text-2xl font-bold text-amber-200">{result.conflicts.length}</p></div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3"><p className="text-[11px] font-bold uppercase text-red-300/70">Erros</p><p className="mt-1 text-2xl font-bold text-red-200">{result.errors.length}</p></div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Importacao concluida</div>
                <p className="mt-1 text-xs text-zinc-400">Total de linhas na planilha: {result.total}</p>
              </div>

              {(result.errors.length > 0 || result.conflicts.length > 0) && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-200"><AlertTriangle className="h-4 w-4" /> Pontos de atencao</div>
                  <div className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-amber-100/80">
                    {result.errors.map((err, index) => <p key={`err-${index}`}>Linha {err.line}: {err.reason}</p>)}
                    {result.conflicts.map((conflict, index) => <p key={`conflict-${index}`}>Linha {conflict.line}: {conflict.field} manteve "{String(conflict.existing ?? "")}" e ignorou "{String(conflict.incoming ?? "")}".</p>)}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="sticky top-0 bg-[#121216] text-[11px] uppercase tracking-wider text-zinc-500">
                      <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Telefone</th><th className="px-3 py-2">Detalhe</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {result.rows.map((row) => (
                        <tr key={`${row.line}-${row.status}`}>
                          <td className="px-3 py-2 text-zinc-500">{row.line}</td>
                          <td className="px-3 py-2">{resultStatusLabel(row.status)}</td>
                          <td className="px-3 py-2">{row.name || "-"}</td>
                          <td className="px-3 py-2">{row.phone || "-"}</td>
                          <td className="px-3 py-2 text-zinc-500">{row.reason || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

    </Modal>
  );
}
