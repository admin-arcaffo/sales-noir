"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Calendar as CalendarIcon,
  Clock,
  Filter,
  MapPin,
  MessageSquare,
  TrendingUp,
  User,
  Video,
  Zap,
} from "lucide-react";
import { getDashboardData, getUpcomingMeetings, type DashboardData } from "@/actions/crm";
import { getHomePage } from "@/lib/nav-order";
import { temperatureBadgeClasses } from "@/components/ui/noir";

type DashboardUser = {
  id: string;
  name: string | null;
};

type MeetingData = {
  id: string;
  title: string;
  type: string;
  scheduledAt: Date | string;
  duration: number;
  meetLink: string | null;
  closer: {
    name: string | null;
  };
};

type DashboardClientProps = {
  initialData: DashboardData;
  initialMeetings: MeetingData[];
  users: DashboardUser[];
};

const tempColors = temperatureBadgeClasses;

export function DashboardClient({ initialData, initialMeetings, users }: DashboardClientProps) {
  const router = useRouter();
  const didMountRef = useRef(false);

  useEffect(() => {
    const home = getHomePage();
    if (home !== "/dashboard") {
      router.replace(home);
    }
  }, [router]);
  const [data, setData] = useState<DashboardData>(initialData);
  const [meetings, setMeetings] = useState<MeetingData[]>(initialMeetings);
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>(""); // Format: YYYY-MM

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    let alive = true;

    let month: number | undefined;
    let year: number | undefined;
    if (filterMonth) {
      const parts = filterMonth.split("-");
      if (parts.length === 2) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      }
    }

    Promise.all([
      getDashboardData({ userId: filterUserId || undefined, month, year }),
      getUpcomingMeetings(filterUserId || undefined),
    ])
      .then(([dashboardData, upcomingMeetings]) => {
        if (!alive) return;
        setData(dashboardData);
        setMeetings(upcomingMeetings);
      })
      .catch((error) => {
        console.error("Failed to load dashboard data:", error);
      });

    return () => {
      alive = false;
    };
  }, [filterUserId, filterMonth]);

  const kpis = [
    { label: "Conversas Ativas", value: data.kpis.activeConversations, icon: MessageSquare, change: "Ao vivo", positive: true },
    { label: "Leads Quentes", value: data.kpis.hotLeads, icon: TrendingUp, change: "Ao vivo", positive: true },
    { label: "Mensagens Agendadas", value: data.kpis.scheduledMessages, icon: Clock, change: "Fila", positive: true },
    { label: "Propostas Abertas", value: data.kpis.proposals, icon: Zap, change: "Ao vivo", positive: false },
  ];

  const pipeline = data.stageDistribution
    .map((stage) => ({
      name: stage.stage,
      count: stage.count,
      color: "bg-emerald-500",
    }))
    .sort((a, b) => b.count - a.count);

  const maxStageCount = Math.max(...pipeline.map((item) => item.count), 1);
  const maxProductCount = Math.max(...data.productVolume.map((item) => item.count), 1);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="heading-page">Dashboard</h1>
            <p className="label-mono mt-2">Visão geral da sua operação comercial</p>
          </div>

          {users.length > 1 && (
            <div className="surface-noir flex items-center gap-3 p-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <Filter className="w-4 h-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Filtros:</span>
              </div>
              <select
                value={filterUserId}
                onChange={(event) => setFilterUserId(event.target.value)}
                className="select-noir w-auto px-2 py-1 text-xs"
              >
                <option value="">Toda a Organização</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <input
                type="month"
                value={filterMonth}
                onChange={(event) => setFilterMonth(event.target.value)}
                className="select-noir w-auto px-2 py-1 text-xs"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="surface-noir p-5 space-y-3 hover:border-zinc-700/80 transition-all"
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
          <div className="lg:col-span-2 space-y-6">
            <div className="surface-noir">
              <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-indigo-400" />
                  <h2 className="label-mono text-indigo-400">Próximas Reuniões</h2>
                </div>
                <span className="label-mono">{meetings.length} agendadas</span>
              </div>
              <div className="divide-y divide-zinc-900">
                {meetings.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs">Nenhuma reunião agendada para hoje ou amanhã.</div>
                ) : (
                  meetings.map((meeting) => {
                    const date = new Date(meeting.scheduledAt);
                    const formattedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
                    return (
                      <div key={meeting.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${meeting.type === "ONLINE" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
                            {meeting.type === "ONLINE" ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-zinc-300">{meeting.title}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{formattedDate} • {meeting.duration} min</p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[10px] text-zinc-400 flex items-center justify-end gap-1"><User className="w-3 h-3" /> {meeting.closer.name}</p>
                          {meeting.type === "ONLINE" && meeting.meetLink && (
                            <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Entrar no Meet</a>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="surface-noir">
              <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h2 className="label-mono">Precisa Agir Hoje</h2>
                </div>
                <span className="label-mono">{data.urgentConversations.length} conversas</span>
              </div>
              <div className="divide-y divide-zinc-900">
                {data.urgentConversations.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-zinc-950 flex items-center justify-center text-[10px] font-bold text-zinc-400 border border-zinc-850">
                        {item.name.split(" ").map((name) => name[0]).join("")}
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
          </div>

          <div className="surface-noir">
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
                      style={{ width: `${(stage.count / maxStageCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-noir lg:col-span-3">
            <div className="p-5 border-b border-zinc-900">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" />
                <h2 className="label-mono">Volume por Produto</h2>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.productVolume.map((product) => (
                <div key={product.product} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-zinc-300 truncate font-semibold" title={product.product}>{product.product}</span>
                    <span className="text-[10px] font-mono text-emerald-400">R$ {product.value.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-zinc-500">{product.count} {product.count === 1 ? "lead" : "leads"}</span>
                  </div>
                  <div className="h-1 bg-zinc-900 border border-zinc-850 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${(product.count / maxProductCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {data.productVolume.length === 0 && (
                <p className="text-xs text-zinc-600 col-span-3 text-center py-4">Nenhum produto associado ainda.</p>
              )}
            </div>
          </div>
        </div>

        <div className="surface-noir">
          <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="label-mono">Análises Recentes</h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-900">
            {data.recentAnalyses.map((item, index) => (
              <div key={`${item.contact}-${index}`} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition-colors cursor-pointer">
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
