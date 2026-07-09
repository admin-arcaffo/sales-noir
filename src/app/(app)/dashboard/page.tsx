export const dynamic = "force-dynamic";

import { getDashboardData, getRecentMeetingAuditLogs, getUpcomingMeetings, getWorkspaceUsers } from "@/actions/crm";
import { ensurePaidWorkspace } from "@/lib/workspace";
import { DashboardClient } from "./DashboardClient";
import type { DashboardData, MeetingAuditLogData } from "@/actions/crm";

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
  closer: { name: string | null };
};

export default async function DashboardPage() {
  let initialData: DashboardData | null = null;
  let initialMeetings: MeetingData[] = [];
  let initialMeetingLogs: MeetingAuditLogData[] = [];
  let users: { id: string; name: string | null }[] = [];
  let fetchError: string | null = null;
  let currentUserId: string | undefined;

  try {
    const workspace = await ensurePaidWorkspace();
    currentUserId = workspace.id;

    const [data, meetings, meetingLogs, workspaceUsers] = await Promise.all([
      getDashboardData({ userId: currentUserId }),
      getUpcomingMeetings(currentUserId),
      getRecentMeetingAuditLogs(12),
      getWorkspaceUsers(),
    ]);
    initialData = data;
    initialMeetings = meetings;
    initialMeetingLogs = meetingLogs;
    users = workspaceUsers.map((user) => ({ id: user.id, name: user.name }));
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Erro desconhecido ao carregar dashboard";
    console.error("[DashboardPage]", fetchError, err);
  }

  return (
    <DashboardClient
      initialData={initialData}
      initialMeetings={initialMeetings}
      initialMeetingLogs={initialMeetingLogs}
      users={users}
      fetchError={fetchError}
      currentUserId={currentUserId}
    />
  );
}
