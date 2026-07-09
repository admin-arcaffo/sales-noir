"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Calendar as CalendarIcon,
  Clock,
  Filter,
  MapPin,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  User,
  Video,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { getDashboardData, getRecentMeetingAuditLogs, getUpcomingMeetings, type DashboardData, type MeetingAuditLogData } from "@/actions/crm";
import { getHomePage } from "@/lib/nav-order";
import { temperatureBadgeClasses } from "@/components/ui/noir";

const NAV_ORDER_KEY = "nav:order";

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
  googleCalendarHtmlLink: string | null;
  calendarSyncStatus: string;
  calendarSyncError: string | null;
  closer: {
    name: string | null;
  };
};

interface DashboardClientProps {
  initialData: DashboardData | null;
  initialMeetings: MeetingData[];
  initialMeetingLogs: MeetingAuditLogData[];
  users: { id: string; name: string | null }[];
  fetchError?: string | null;
  currentUserId?: string;
};

const tempColors = temperatureBadgeClasses;

const meetingLogLabels: Record<string, string> = {
  MEETING_CREATE_ATTEMPT: "Tentativa",
  MEETING_GOOGLE_SUCCESS: "Google criado",
  MEETING_GOOGLE_FAILURE: "Falha Google",
  MEETING_CREATE_FAILED: "Falha",
  MEETING_CREATED: "Criado",
  MEETING_WHATSAPP_CONFIRMATION_FAILED: "Falha WhatsApp",
  MEETING_REMINDER_SCHEDULE_FAILED: "Falha lembrete",
  MEETING_STAGE_UPDATE_FAILED: "Falha estágio",
};

export function DashboardClient({ initialData, initialMeetings, initialMeetingLogs, users, fetchError, currentUserId }: DashboardClientProps) {
  const router = useRouter();
  const didMountRef = useRef(false);

  useEffect(() => {
    const hasCustomOrder = typeof window !== "undefined" && localStorage.getItem(NAV_ORDER_KEY) !== null;
    if (!hasCustomOrder) return;
    const home = getHomePage();
    if (home !== "/dashboard") {
      const hasEntered = typeof window !== "undefined" && sessionStorage.getItem("app:entered") === "true";
      if (!hasEntered) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("app:entered", "true");
        }
        router.replace(home);
      }
    }
  }, [router]);

  const [data, setData] = useState<DashboardData | null>(initialData);
  const [meetings, setMeetings] = useState<MeetingData[]>(initialMeetings);
  const [meetingLogs, setMeetingLogs] = useState<MeetingAuditLogData[]>(initialMeetingLogs);
  const [filterUserId, setFilterUserId] = useState<string>(currentUserId || "");
  const [filterMonth, setFilterMonth] = useState<string>("");

  useEffect(() => {
    if (!initialData) return;
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
      getRecentMeetingAuditLogs(12),
    ])
      .then(([dashboardData, upcomingMeetings, recentMeetingLogs]) => {
        if (!alive) return;
        setData(dashboardData);
        setMeetings(upcomingMeetings);
        setMeetingLogs(recentMeetingLogs);
      })
      .catch((error) => {
        console.error("Failed to load dashboard data:", error);
      });

    return () => {
      alive = false;
    };
  }, [filterUserId, filterMonth, initialData]);

  if (fetchError && !initialData) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="surface-noir-muted flex w-full max-w-md flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Erro ao carregar dados</h2>
            <p className="mt-2 text-sm text-zinc-500">{fetchError}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.refresh()}
              className="btn-noir flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
            <Link
              href="/conversations"
              className="btn-noir-secondary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
            >
              Ir para Conversas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-800 border-t-white" />
          <p className="text-sm">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

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
                    const calendarSynced = meeting.calendarSyncStatus === "SYNCED";
                    return (
                      <div key={meeting.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${meeting.type === "ONLINE" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
                            {meeting.type === "ONLINE" ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-zinc-300">{meeting.title}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{formattedDate} • {meeting.duration} min</p>
                            <p className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold ${calendarSynced ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>
                              {calendarSynced ? "Google confirmado" : `Google: ${meeting.calendarSyncStatus}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[10px] text-zinc-400 flex items-center justify-end gap-1"><User className="w-3 h-3" /> {meeting.closer.name}</p>
                          {meeting.googleCalendarHtmlLink && (
                            <a href={meeting.googleCalendarHtmlLink} target="_blank" rel="noopener noreferrer" className="block text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors">Abrir no Google</a>
                          )}
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
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h2 className="label-mono text-emerald-400">Histórico de Agenda</h2>
                </div>
                <span className="label-mono">{meetingLogs.length} registros</span>
              </div>
              <div className="divide-y divide-zinc-900">
                {meetingLogs.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-xs">Nenhum registro de agendamento recente.</div>
                ) : (
                  meetingLogs.map((log) => {
                    const createdAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.createdAt));
                    const scheduledAt = log.scheduledAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.scheduledAt)) : "sem data";
                    const statusClass = log.status === "SUCCESS"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : log.status === "FAILED"
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400";
                    return (
                      <div key={log.id} className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-900/40 transition-colors">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${statusClass}`}>
                              {meetingLogLabels[log.action] || log.action}
                            </span>
                            <span className="text-[10px] text-zinc-500">{createdAt}</span>
                          </div>
                          <p className="mt-2 truncate text-[11px] font-bold text-zinc-300">{log.title || "Agendamento"}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">Marcado para {scheduledAt}{log.userName || log.userEmail ? ` por ${log.userName || log.userEmail}` : ""}</p>
                          {log.error && <p className="mt-1 text-[10px] text-rose-300">{log.error}</p>}
                        </div>
                        {log.googleCalendarHtmlLink && (
                          <a href={log.googleCalendarHtmlLink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors">Google</a>
                        )}
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
