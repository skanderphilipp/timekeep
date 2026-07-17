import { PageShell } from "@/components/layout";
import { ReportsView } from "../components/reports-view";
import { useReportCommands } from "../hooks/use-reports-commands";

export function ReportsPage() {
  useReportCommands();
  return (
    <PageShell>
      <ReportsView />
    </PageShell>
  );
}
