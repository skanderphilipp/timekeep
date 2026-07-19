import { IconFingerprint, IconUsers, IconUsersPlus } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useSetAtom } from "jotai";

import { PageShell, PageBar } from "@/components/layout";
import { RecordDetailRenderer } from "@/modules/record-detail";
import { useEmployeeDetailPage } from "../hooks/use-employee-detail-page";
import { useEmployeeDetailCommands } from "../hooks/use-employee-detail-commands";
import { useEmployeeSync } from "../hooks/use-employee-sync";
import { EnrollmentWizard } from "../components/enrollment-wizard";
import { Button } from "@/components/ui";
import { useToast } from "@/infrastructure/toast/toast";
import { openSidePanelAtom } from "@/infrastructure/state";

/**
 * Employee detail page - thin composite.
 *
 * Delegates all detail rendering to RecordDetailRenderer (ADR-008).
 * Domain-specific actions (Sync to Devices, Enroll Fingerprint) live here.
 * "Enroll Fingerprint" opens a live side panel wizard with SSE progress.
 */
export function EmployeeDetailPage() {
  const page = useEmployeeDetailPage();
  const { _ } = useLingui();
  const toast = useToast();
  const syncToDevices = useEmployeeSync(page.id);
  const openSidePanel = useSetAtom(openSidePanelAtom);
  useEmployeeDetailCommands();

  /**
   * Opens the enrollment wizard in the side panel.
   *
   * The wizard shows live SSE progress: finger scores (sample 1-3),
   * enrollment success, and a "Sync to Devices" button after completion.
   * HR is not blocked - the panel can be dismissed and re-opened.
   */
  const handleEnrollFinger = () => {
    if (!page.employee?.pin) {
      toast.error(_(msg`Employee has no PIN assigned.`));
      return;
    }

    const deviceSn = window.prompt(
      _(msg`Enter the device serial number (typically the onboarding device):`),
    );
    if (!deviceSn) return;

    const employeeName = page.employee.name;
    const employeePin = page.employee.pin;
    const employeeId = page.id;

    openSidePanel({
      title: `${_(msg`Enroll Fingerprint`)} \u2014 ${employeeName}`,
      render: () => (
        <EnrollmentWizard
          deviceSn={deviceSn}
          employeePin={employeePin}
          employeeName={employeeName}
          employeeId={employeeId}
          onClose={() => {}}
        />
      ),
    });
  };

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
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconFingerprint size={16} />}
              onClick={handleEnrollFinger}
            >
              {_(msg`Enroll Fingerprint`)}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconUsersPlus size={16} />}
              onClick={() => syncToDevices.mutate()}
              loading={syncToDevices.isPending}
            >
              {_(msg`Sync to Devices`)}
            </Button>
          </>
        }
      />
    </PageShell>
  );
}
