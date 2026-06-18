"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare, TrendingUp, Clock,
  AlertCircle, Zap, ArrowUpRight, BarChart3
} from "lucide-react";
import { getDashboardData, type DashboardData } from "@/actions/crm";

const tempColors = {
  hot: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  warm: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  cold: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

export default function DashboardPage() {
  const { userId, isLoaded } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to sign-in if not authenticated (Is handled by middleware, but kept for client safety if needed)
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in');
    }
  }, [isLoaded, userId, router]);

  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    getDashboardData()
      .then((result) => {
        if (alive) {
          setData(result);
        }
      })
      .catch((error) => {
        console.error("Failed to load dashboard data:", error);
      });

    return () => {
      alive = false;
    };
  }, []);

  const kpis = [
    { label: "Conversas Ativas", value: data?.kpis.activeConversations ?? "-", icon: MessageSquare, change: "Ao vivo", positive: true },
    { label: "Leads Quentes", value: data?.kpis.hotLeads ?? "-", icon: TrendingUp, change: "Ao vivo", positive: true },
    { label: "Aguardando Retorno", value: data?.kpis.pendingTasks ?? "-", icon: Clock, change: "Ao vivo", positive: false },
    { label: "Propostas Abertas", value: data?.kpis.proposals ?? "-", icon: Zap, change: "Ao vivo", positive: false },
  ];

  const pipeline = [
    { name: "Primeiro Contato", count: data?.kpis.activeConversations ?? 0, color: "bg-zinc-600" },
    { name: "Qualificação", count: Math.max((data?.kpis.hotLeads ?? 0) - 1, 0), color: "bg-blue-500" },
    { name: "Proposta", count: data?.kpis.proposals ?? 0, color: "bg-amber-500" },
    { name: "Negociação", count: Math.max((data?.kpis.proposals ?? 0) - 2, 0), color: "bg-orange-500" },
    { name: "Fechamento", count: Math.max((data?.kpis.pendingTasks ?? 0) - 1, 0), color: "bg-emerald-500" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-wider">Dashboard</h1>
          <p className="label-mono mt-2">Visão geral da sua operação comercial</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-[#09090b] border border-zinc-900 rounded p-5 space-y-3 hover:border-zinc-700/80 transition-all"
            >
              <div className="flex items-center justify-between">
                <kpi.icon className="w-4 h-4 text-zinc-500" />
                <span className={`font-mono text-[8px] px-2 py-0.5 rounded border ${
                  kpi.positive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-zinc-500 bg-zinc-800 border-zinc-700"
                }`}>
                  {kpi.change}
                </span>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white tracking-tight">{kpi.value}</p>
                <p className="label-mono mt-1">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#09090b] border border-zinc-900 rounded">
            <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h2 className="label-mono">Precisa Agir Hoje</h2>
              </div>
              <span className="label-mono">{data?.urgentConversations.length ?? 0} conversas</span>
            </div>
            <div className="divide-y divide-zinc-900">
              {(data?.urgentConversations ?? []).map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-950 flex items-center justify-center text-[10px] font-bold text-zinc-400 border border-zinc-850">
                      {item.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-zinc-300">{item.name}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">{item.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-[8px] px-2 py-0.5 rounded border ${tempColors[item.temperature]}`}>
                      {item.temperature.toUpperCase()}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#09090b] border border-zinc-900 rounded">
            <div className="p-5 border-b border-zinc-900">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" />
                <h2 className="label-mono">Pipeline</h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {pipeline.map((stage) => (
                <div key={stage.name} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-400">{stage.name}</span>
                    <span className="text-[10px] font-bold text-zinc-300">{stage.count}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 border border-zinc-850 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage.color} transition-all duration-500`}
                      style={{ width: `${Math.min((stage.count / Math.max(data?.kpis.activeConversations || 1, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#09090b] border border-zinc-900 rounded">
          <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="label-mono">Análises Recentes</h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-900">
            {(data?.recentAnalyses ?? []).map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded bg-zinc-950 flex items-center justify-center border border-zinc-850">
                    <Zap className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-zinc-300">{item.contact}</p>
                    <p className="text-[8px] font-mono text-zinc-500 mt-0.5">{item.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[8px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded">{item.stage}</span>
                  <span className={`font-mono text-[8px] px-2 py-0.5 rounded border ${
                    item.risk === "ALTO" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                    item.risk === "MODERADO" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  }`}>
                    {item.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
