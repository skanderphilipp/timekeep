import { IconLayersSubtract } from "@tabler/icons-react";

import { PageShell, PageBar } from "@/components/layout";
import { RecordDetailRenderer } from "@/modules/record-detail";
import { useDeviceGroupDetailPage } from "../hooks/use-device-group-detail-page";
import { DeviceGroupSyncSection } from "../components/device-group-sync-section";
import { DeviceGroupDevicesTab } from "../components/device-group-devices-tab";

/**
 * Device Group detail page — thin composite.
 *
 * Delegates loading/error/empty states, header rendering, and tab structure
 * to {@link RecordDetailRenderer} (ADR-008).
 *
 * Tab structure via `DETAIL_VIEW_CONFIGS.device_group.tabs`:
 *   - Details tab: Info section (declarative fields)
 *   - Sync tab: DeviceGroupSyncSection (via `tabChildren.sync`)
 */
export function DeviceGroupDetailPage() {
  const page = useDeviceGroupDetailPage();

  return (
    <PageShell
      pageLabel={page.pageLabel}
      header={
        <PageBar
          title={page.title}
          description={page.group?.description ?? undefined}
          icon={IconLayersSubtract}
        />
      }
    >
      <RecordDetailRenderer
        entity="device_group"
        entityId={page.id}
        isInSidePanel={false}
        tabChildren={
          page.group
            ? {
                devices: <DeviceGroupDevicesTab group={page.group} />,
                sync: <DeviceGroupSyncSection group={page.group} />,
              }
            : undefined
        }
      />
    </PageShell>
  );
}
