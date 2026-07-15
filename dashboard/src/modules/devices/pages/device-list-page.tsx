import { PageShell } from "@/components/layout";
import { useDeviceListCommands } from "../hooks/use-device-list-commands";
import { DeviceListView } from "../components/device-list-view";

export function DeviceListPage() {
  useDeviceListCommands();

  return (
    <PageShell>
      <DeviceListView />
    </PageShell>
  );
}
