import { IconDeviceDesktop } from "@tabler/icons-react";

import { PageShell, PageBar } from "@/components/layout";
import { RecordDetailRenderer } from "@/modules/record-detail";
import { useDeviceDetailPage } from "../hooks/use-device-detail-page";
import { useDeviceDetailCommands } from "../hooks/use-device-detail-commands";
import {
  DeviceDetailExtras,
  DeviceConfigTabContent,
  DeviceUsersTabContent,
} from "../components/device-detail-content";

/**
 * Device detail page — thin composite.
 *
 * Delegates loading/error/empty states, header rendering, and tab structure
 * to {@link RecordDetailRenderer} (ADR-008).
 *
 * Tab structure is declarative via `DETAIL_VIEW_CONFIGS.device.tabs`:
 *   - Info tab: Connection + Status field sections (declarative)
 *   - Config tab: DeviceForm (via `tabChildren.config`)
 *   - Users tab: UserSyncActions + DeviceUsersTab (via `tabChildren.users`)
 *
 * Extra UI outside tabs (status bar, health cards, activity feed, dialogs)
 * is passed as `children`.
 */
export function DeviceDetailPage() {
  const page = useDeviceDetailPage();
  useDeviceDetailCommands();

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
      <RecordDetailRenderer
        entity="device"
        entityId={page.sn}
        isInSidePanel={false}
        tabChildren={
          page.device
            ? {
                config: (
                  <DeviceConfigTabContent
                    device={page.device}
                    onRefresh={() => page.refetch()}
                  />
                ),
                users: (
                  <DeviceUsersTabContent
                    device={page.device}
                    onRefresh={() => page.refetch()}
                  />
                ),
              }
            : undefined
        }
      >
        {page.device && (
          <DeviceDetailExtras
            device={page.device}
            deviceHealth={page.deviceHealth}
            onRefresh={() => page.refetch()}
          />
        )}
      </RecordDetailRenderer>
    </PageShell>
  );
}
