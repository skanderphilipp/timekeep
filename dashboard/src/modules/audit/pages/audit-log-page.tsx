import { PageShell } from "@/components/layout";
import { AuditLogView } from "../components/audit-log-view";
import { useAuditCommands } from "../hooks/use-audit-commands";

export function AuditLogPage() {
  useAuditCommands();
  return (
    <PageShell>
      <AuditLogView />
    </PageShell>
  );
}
