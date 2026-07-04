import { getReportsData } from "@/actions/crm";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const initialData = await getReportsData();

  return <ReportsClient initialData={initialData} />;
}
