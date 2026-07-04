export const dynamic = "force-dynamic";

import { getDashboardData, getUpcomingMeetings, getWorkspaceUsers } from "@/actions/crm";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const [initialData, initialMeetings, users] = await Promise.all([
    getDashboardData(),
    getUpcomingMeetings(),
    getWorkspaceUsers(),
  ]);

  return (
    <DashboardClient
      initialData={initialData}
      initialMeetings={initialMeetings}
      users={users.map((user) => ({ id: user.id, name: user.name }))}
    />
  );
}
