import { PageLayout, PageBody } from "@/components/layout";
import { AuditLogView } from "../components/audit-log-view";

export function AuditLogPage() {
  return (
    <PageLayout>
      <PageBody>
        <AuditLogView />
      </PageBody>
    </PageLayout>
  );
}
