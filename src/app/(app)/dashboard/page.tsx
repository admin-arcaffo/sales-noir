"use client";

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
  const { userId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to sign-in if not authenticated
  if (!userId && pathname !== '/sign-in' && pathname !== '/sign-up') {
    router.push('/sign-in');
    return null; // Prevent rendering while redirecting
  }

  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Visão geral da sua operação comercial</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-5 space-y-3 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <kpi.icon className="w-5 h-5 text-zinc-500" />
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${
                  kpi.positive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-zinc-500 bg-zinc-800 border-zinc-700"
                }`}>
                  {kpi.change}
                </span>
              </div>
              <div>
                <p className="text-3xl font-semibold text-zinc-100 tracking-tight">{kpi.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0c0c0e] border border-white/[0.06] rounded-xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Precisa Agir Hoje</h2>
              </div>
              <span className="text-[11px] text-zinc-500">{data?.urgentConversations.length ?? 0} conversas</span>
            </div>
            <div className="divide-y divide-white/5">
              {(data?.urgentConversations ?? []).map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-400 border border-zinc-700/50">
                      {item.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{item.name}</p>
                      <p className="text-xs text-zinc-500">{item.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tempColors[item.temperature]}`}>
                      {item.temperature.toUpperCase()}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl">
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" />
                <h2 className="text-sm font-semibold text-zinc-200">Pipeline</h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {pipeline.map((stage) => (
                <div key={stage.name} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-400">{stage.name}</span>
                    <span className="text-xs font-semibold text-zinc-300">{stage.count}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
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

        <div className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-200">Análises Recentes</h2>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {(data?.recentAnalyses ?? []).map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <Zap className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-200">{item.contact}</p>
                    <p className="text-xs text-zinc-500">{item.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded">{item.stage}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
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
