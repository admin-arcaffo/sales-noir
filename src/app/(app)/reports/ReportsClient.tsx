"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BarChart3, CalendarDays, ChevronDown, DollarSign, Download, FileSpreadsheet, FileText, Filter, Loader2, Target, TrendingUp, Users } from "lucide-react";
import { exportReportCsv, exportReportXlsx, fetchReportDeals, getReportsData, type ReportsData } from "@/actions/crm";

type ReportsClientProps = {
  initialData: ReportsData;
};

type TabId = "financial" | "commercial" | "pipeline" | "risk";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "financial", label: "Financeiro" },
  { id: "commercial", label: "Comercial" },
  { id: "pipeline", label: "Pipeline" },
  { id: "risk", label: "Risco" },
];

const chartColors = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  return `${(value || 0).toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
}

function KpiCard({ label, value, helper, icon: Icon, tone = "emerald" }: { label: string; value: string; helper: string; icon: typeof DollarSign; tone?: "emerald" | "indigo" | "amber" | "red" }) {
  const toneClass = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  }[tone];

  return (
    <div className="surface-noir p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${toneClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="label-mono">{helper}</span>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
        <p className="label-mono mt-1">{label}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-noir overflow-hidden">
      <div className="p-5 border-b border-zinc-900 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-zinc-500" />
        <h2 className="label-mono text-zinc-300">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="h-48 flex items-center justify-center text-xs text-zinc-600">{label}</div>;
}

export function ReportsClient({ initialData }: ReportsClientProps) {
  const didMountRef = useRef(false);
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabId>("financial");
  const [from, setFrom] = useState(initialData.filters.from);
  const [to, setTo] = useState(initialData.filters.to);
  const [userId, setUserId] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [productId, setProductId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [format, setFormat] = useState<"xlsx" | "csv" | "pdf">("xlsx");
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const formatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (formatRef.current && !formatRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    let alive = true;
    startTransition(() => {
      getReportsData({ from, to, userId: userId || undefined, productId: productId || undefined })
        .then((nextData) => {
          if (alive) setData(nextData);
        })
        .catch((error) => console.error("Failed to load reports:", error));
    });

    return () => {
      alive = false;
    };
  }, [from, to, userId, productId]);

  const downloadBlob = useCallback((blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${from}-a-${to}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [from, to]);

  const exportXlsx = useCallback(async () => {
    const base64 = await exportReportXlsx({ from, to, userId: userId || undefined, productId: productId || undefined });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "xlsx");
  }, [from, to, userId, productId, downloadBlob]);

  const exportCsv = useCallback(async () => {
    const csv = await exportReportCsv({ from, to, userId: userId || undefined, productId: productId || undefined });
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "csv");
  }, [from, to, userId, productId, downloadBlob]);

  const exportPdf = useCallback(async () => {
    const deals = await fetchReportDeals({ from, to, userId: userId || undefined, productId: productId || undefined });
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    doc.setFontSize(14);
    doc.text("Relatorio de Vendas", 14, 20);
    doc.setFontSize(8);
    doc.text(`Periodo: ${from} a ${to}`, 14, 26);

    const rows = deals.map((d) => [
      d.nome,
      `R$ ${d.valorTotal.toFixed(2)}`,
      d.dataPrimeiroPagamento,
      `R$ ${d.valorPrimeiroPagamento.toFixed(2)}`,
      `R$ ${d.sinal.toFixed(2)}`,
      String(d.parcelas),
      d.tempo,
    ]);

    (doc as any).autoTable({
      startY: 30,
      head: [["Nome", "Valor total", "Data 1o pagto", "Valor 1o pagto", "Sinal", "Parcelas", "Projeto"]],
      body: rows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [16, 185, 129] },
      margin: { top: 30 },
    });

    downloadBlob(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }), "pdf");
  }, [from, to, userId, productId, downloadBlob]);

  const handleExport = useCallback(() => {
    setShowFormatMenu(false);
    setIsExporting(true);
    const runner = format === "xlsx" ? exportXlsx : format === "csv" ? exportCsv : exportPdf;
    runner().catch((err) => console.error("Export failed:", err)).finally(() => setIsExporting(false));
  }, [format, exportXlsx, exportCsv, exportPdf]);

  const cashForecastData = data.financial.cashForecast.map((item) => ({ ...item, label: formatDate(item.date) }));

  return (
    <div className="h-full overflow-y-auto bg-[#040406]">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="heading-page">Relatorios</h1>
              <p className="text-[11px] text-zinc-500 hidden sm:block">Financeiro, comercial, pipeline e risco</p>
            </div>

            <div className="surface-noir flex flex-wrap items-center gap-2 p-2">
              <div className="flex items-center gap-1.5 text-zinc-400 mr-1">
                <Filter className="w-3.5 h-3.5" />
                {isPending && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
              </div>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="select-noir w-[130px] px-2 py-1 text-[11px]" />
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="select-noir w-[130px] px-2 py-1 text-[11px]" />
              <select value={userId} onChange={(event) => setUserId(event.target.value)} className="select-noir w-auto px-2 py-1 text-[11px]">
                <option value="">Todos vendedores</option>
                {data.users.map((user) => <option key={user.id} value={user.id}>{user.name || "Sem nome"}</option>)}
              </select>
              <select value={productId} onChange={(event) => setProductId(event.target.value)} className="select-noir w-auto px-2 py-1 text-[11px]">
                <option value="">Todos produtos</option>
                {data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
              <div className="relative" ref={formatRef}>
                <div className="flex rounded border border-emerald-500/30 overflow-hidden">
                  <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50">
                    {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    {format.toUpperCase()}
                  </button>
                  <button onClick={() => setShowFormatMenu((prev) => !prev)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-1.5 py-1 border-l border-emerald-500/30 transition-all">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                {showFormatMenu && (
                  <div className="surface-noir absolute right-0 top-full z-50 mt-1 w-28 overflow-hidden shadow-xl">
                    {(["xlsx", "csv", "pdf"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => { setFormat(f); setShowFormatMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all ${format === f ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}`}
                      >
                        {f === "xlsx" ? <FileSpreadsheet className="w-3 h-3" /> : f === "csv" ? <FileText className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 px-3 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab.id ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-zinc-500 hover:text-zinc-300"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {activeTab === "financial" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Receita Fechada" value={formatMoney(data.financial.totalRevenue)} helper={`${data.financial.dealCount} vendas`} icon={DollarSign} />
              <KpiCard label="Ticket Medio" value={formatMoney(data.financial.averageTicket)} helper="por venda" icon={TrendingUp} tone="indigo" />
              <KpiCard label="Sinal Recebido" value={formatMoney(data.financial.signalRevenue)} helper="caixa imediato" icon={Target} tone="amber" />
              <KpiCard label="Previsao 90 dias" value={formatMoney(data.financial.cashForecast.reduce((sum, item) => sum + item.value, 0))} helper="1os pagamentos" icon={CalendarDays} tone="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Section title="Receita Mensal">
                <div className="h-80">
                  {data.financial.monthlyRevenue.length === 0 ? <EmptyState label="Sem vendas no periodo." /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.financial.monthlyRevenue}>
                        <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid stroke="#18181b" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#fff" }} />
                        <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revenueFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Section>

              <Section title="Forma de Pagamento">
                <div className="h-80">
                  {data.financial.paymentDistribution.length === 0 ? <EmptyState label="Sem dados de pagamento." /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.financial.paymentDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                          {data.financial.paymentDistribution.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#fff" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Section>

              <Section title="Pagou Sinal">
                <div className="h-80">
                  {data.financial.signalDistribution.length === 0 ? <EmptyState label="Sem dados de sinal." /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.financial.signalDistribution} dataKey="value" nameKey="name" outerRadius={95} label>
                          {data.financial.signalDistribution.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#fff" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Previsao de Caixa">
                <div className="space-y-2">
                  {cashForecastData.length === 0 ? <EmptyState label="Sem pagamentos futuros nos proximos 90 dias." /> : cashForecastData.map((item) => (
                    <div key={`${item.client}-${item.date}`} className="flex items-center justify-between rounded border border-zinc-900 bg-black/20 px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-zinc-200">{item.client}</p>
                        <p className="text-[10px] text-zinc-500">{item.label}</p>
                      </div>
                      <span className="text-xs font-mono text-emerald-400">{formatMoney(item.value)}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Tempo de Projeto">
                <div className="space-y-2">
                  {data.financial.projectDurations.length === 0 ? <EmptyState label="Sem duracao preenchida." /> : data.financial.projectDurations.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-zinc-300">{item.name}</span><span className="font-mono text-zinc-500">{item.value}</span></div>
                      <div className="h-1.5 bg-zinc-950 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (item.value / Math.max(...data.financial.projectDurations.map((row) => row.value), 1)) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        )}

        {activeTab === "commercial" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Win Rate" value={formatPercent(data.commercial.winRate)} helper={`${data.commercial.wonLeads}/${data.commercial.totalLeads} leads`} icon={Target} />
              <KpiCard label="Ciclo Medio" value={`${data.commercial.averageSalesCycleDays.toFixed(0)} dias`} helper="lead ate fechamento" icon={CalendarDays} tone="indigo" />
              <KpiCard label="Produtos Vendidos" value={String(data.commercial.productsSold.reduce((sum, item) => sum + item.count, 0))} helper="itens" icon={BarChart3} tone="amber" />
              <KpiCard label="Vendedores" value={String(data.commercial.sellersRanking.length)} helper="com venda" icon={Users} tone="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Funil Atual">
                <div className="h-80">
                  {data.commercial.funnel.length === 0 ? <EmptyState label="Sem conversas no funil." /> : (
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={data.commercial.funnel} layout="vertical"><CartesianGrid stroke="#18181b" horizontal={false} /><XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="stage" width={120} tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8 }} /><Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>
                  )}
                </div>
              </Section>

              <Section title="Produtos Mais Vendidos">
                <div className="h-80">
                  {data.commercial.productsSold.length === 0 ? <EmptyState label="Sem produtos vendidos." /> : (
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={data.commercial.productsSold.slice(0, 8)}><CartesianGrid stroke="#18181b" vertical={false} /><XAxis dataKey="product" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8 }} /><Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
                  )}
                </div>
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Ranking de Vendedores">
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-zinc-500"><tr><th className="text-left py-2">Vendedor</th><th className="text-right py-2">Receita</th><th className="text-right py-2">Deals</th><th className="text-right py-2">Ticket</th><th className="text-right py-2">Ciclo</th></tr></thead><tbody className="divide-y divide-zinc-900">{data.commercial.sellersRanking.map((seller) => <tr key={seller.seller}><td className="py-2 text-zinc-300">{seller.seller}</td><td className="py-2 text-right text-emerald-400 font-mono">{formatMoney(seller.revenue)}</td><td className="py-2 text-right text-zinc-400">{seller.deals}</td><td className="py-2 text-right text-zinc-400">{formatMoney(seller.averageTicket)}</td><td className="py-2 text-right text-zinc-400">{seller.averageCycleDays.toFixed(0)}d</td></tr>)}</tbody></table>{data.commercial.sellersRanking.length === 0 && <EmptyState label="Sem vendedores com vendas." />}</div>
              </Section>

              <Section title="Origem dos Leads">
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-zinc-500"><tr><th className="text-left py-2">Origem</th><th className="text-right py-2">Leads</th><th className="text-right py-2">Fechados</th><th className="text-right py-2">Conv.</th></tr></thead><tbody className="divide-y divide-zinc-900">{data.commercial.leadsByOrigin.map((origin) => <tr key={origin.origin}><td className="py-2 text-zinc-300">{origin.origin}</td><td className="py-2 text-right text-zinc-400">{origin.leads}</td><td className="py-2 text-right text-zinc-400">{origin.won}</td><td className="py-2 text-right text-emerald-400 font-mono">{formatPercent(origin.conversion)}</td></tr>)}</tbody></table>{data.commercial.leadsByOrigin.length === 0 && <EmptyState label="Sem origens no periodo." />}</div>
              </Section>
            </div>

            <Section title="Temperatura vs Conversao">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data.commercial.temperatureConversion.map((item) => <div key={item.temperature} className="rounded border border-zinc-900 bg-black/20 p-4"><p className="text-xs font-bold text-zinc-300">{item.temperature}</p><p className="text-2xl font-extrabold text-white mt-2">{formatPercent(item.conversion)}</p><p className="text-[10px] text-zinc-500 mt-1">{item.won} fechados de {item.total}</p></div>)}
              </div>
            </Section>
          </div>
        )}

        {activeTab === "pipeline" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Valor Atual por Etapa">
                <div className="h-80">{data.pipeline.valueByStage.length === 0 ? <EmptyState label="Sem leads ativos." /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={data.pipeline.valueByStage}><CartesianGrid stroke="#18181b" vertical={false} /><XAxis dataKey="stage" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8 }} /><Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>}</div>
              </Section>

              <Section title="Tarefas por Vendedor">
                <div className="space-y-2">{data.pipeline.tasksByUser.length === 0 ? <EmptyState label="Sem tarefas pendentes." /> : data.pipeline.tasksByUser.map((item) => <div key={item.user} className="flex items-center justify-between rounded border border-zinc-900 bg-black/20 px-3 py-2"><span className="text-xs text-zinc-300">{item.user}</span><div className="flex gap-2"><span className="text-[10px] text-zinc-400">{item.pending} pendentes</span><span className="text-[10px] text-red-400">{item.overdue} atrasadas</span></div></div>)}</div>
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Leads Estagnados +14 dias">
                <div className="space-y-2">{data.pipeline.stagnantLeads.length === 0 ? <EmptyState label="Nenhum lead estagnado." /> : data.pipeline.stagnantLeads.map((lead) => <div key={lead.id} className="flex items-center justify-between rounded border border-zinc-900 bg-black/20 px-3 py-2"><div><p className="text-xs font-bold text-zinc-200">{lead.name}</p><p className="text-[10px] text-zinc-500">{lead.stage}</p></div><div className="text-right"><p className="text-xs font-mono text-amber-400">{lead.days} dias</p><p className="text-[10px] text-zinc-500">{formatMoney(lead.value)}</p></div></div>)}</div>
              </Section>

              <Section title="Proximas Reunioes">
                <div className="space-y-2">{data.pipeline.upcomingMeetings.length === 0 ? <EmptyState label="Sem reunioes nos proximos 14 dias." /> : data.pipeline.upcomingMeetings.map((meeting) => <div key={meeting.id} className="flex items-center justify-between rounded border border-zinc-900 bg-black/20 px-3 py-2"><div><p className="text-xs font-bold text-zinc-200">{meeting.title}</p><p className="text-[10px] text-zinc-500">{meeting.closer || "Sem closer"}</p></div><span className="text-xs font-mono text-indigo-400">{formatDate(meeting.date)}</span></div>)}</div>
              </Section>
            </div>
          </div>
        )}

        {activeTab === "risk" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard label="Leads Risco Alto" value={String(data.risk.highRiskLeads.length)} helper="IA" icon={AlertTriangle} tone="red" />
              <KpiCard label="Sem Contato +7 dias" value={String(data.risk.staleConversations.length)} helper="conversas" icon={CalendarDays} tone="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Risco Alto pela IA">
                <div className="space-y-2">{data.risk.highRiskLeads.length === 0 ? <EmptyState label="Nenhum risco alto recente." /> : data.risk.highRiskLeads.map((lead) => <div key={`${lead.id}-${lead.createdAt}`} className="rounded border border-red-500/20 bg-red-500/5 p-3"><div className="flex justify-between gap-3"><p className="text-xs font-bold text-zinc-200">{lead.name}</p><span className="text-[10px] text-red-300 font-mono">{lead.urgency}</span></div><p className="text-[10px] text-zinc-500 mt-2">{lead.nextStep}</p></div>)}</div>
              </Section>

              <Section title="Sem Contato Recente">
                <div className="space-y-2">{data.risk.staleConversations.length === 0 ? <EmptyState label="Nenhuma conversa fria." /> : data.risk.staleConversations.map((conversation) => <div key={conversation.id} className="flex items-center justify-between rounded border border-zinc-900 bg-black/20 px-3 py-2"><div><p className="text-xs font-bold text-zinc-200">{conversation.name}</p><p className="text-[10px] text-zinc-500">{conversation.stage}</p></div><span className="text-xs font-mono text-amber-400">{conversation.days} dias</span></div>)}</div>
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
