import { IconUsers, IconUsersPlus } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PageShell, PageBar } from "@/components/layout";
import { RecordDetailRenderer } from "@/modules/record-detail";
import { useEmployeeDetailPage } from "../hooks/use-employee-detail-page";
import { useEmployeeDetailCommands } from "../hooks/use-employee-detail-commands";
import { useEmployeeSync } from "../hooks/use-employee-sync";
import { Button } from "@/components/ui";

/**
 * Employee detail page — thin composite.
 *
 * Delegates all detail rendering to {@link RecordDetailRenderer} (ADR-008).
 * Only the page shell and the domain-specific Sync to Devices button stay here.
 * The renderer auto-fetches attendance KPIs and log.
 */
export function EmployeeDetailPage() {
  const page = useEmployeeDetailPage();
  const { _ } = useLingui();
  const syncToDevices = useEmployeeSync(page.id);
  useEmployeeDetailCommands();

  return (
    <PageShell
      pageLabel={page.pageLabel}
      header={<PageBar title={page.title} icon={IconUsers} />}
    >
      <RecordDetailRenderer
        entity="employee"
        entityId={page.id}
        isInSidePanel={false}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<IconUsersPlus size={16} />}
            onClick={() => syncToDevices.mutate()}
            loading={syncToDevices.isPending}
          >
            {_(msg`Sync to Devices`)}
          </Button>
        }
      />
    </PageShell>
  );
}
