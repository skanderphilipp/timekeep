import { PageShell } from "@/components/layout";
import { DeviceGroupsView } from "../components/device-groups-view";

/**
 * Device Groups list page — thin composite.
 */
export function DeviceGroupsPage() {
  return (
    <PageShell>
      <DeviceGroupsView />
    </PageShell>
  );
}
