import { IconDeviceDesktop } from "@tabler/icons-react";

import { PageShell, PageBar } from "@/components/layout";
import { DeviceDetailView } from "../components/device-detail-view";
import { useDeviceDetailPage } from "../hooks/use-device-detail-page";

/**
 * Device detail page — thin composite.
 *
 * All logic (route params, data fetching, label derivation) lives in
 * {@link useDeviceDetailPage}. The page only wires the result to
 * layout components.
 */
export function DeviceDetailPage() {
  const page = useDeviceDetailPage();

  return (
    <PageShell
      pageLabel={page.pageLabel}
      header={
        <PageBar
          title={page.title}
          description={page.subtitle}
          icon={IconDeviceDesktop}
        />
      }
    >
      <DeviceDetailView
        device={page.device}
        deviceHealth={page.deviceHealth ?? null}
        isLoading={page.isLoading}
        error={page.error}
        onRetry={() => page.refetch()}
      />
    </PageShell>
  );
}
