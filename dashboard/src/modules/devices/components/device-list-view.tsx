import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconRadar } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { useDeviceList } from "../hooks/use-device-list";
import { Section, Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView } from "@/modules/data-renderer";
import type { DeviceSummary } from "@/lib/api";
import { DeviceCard } from "./device-card";
import { ScanNetworkDialog } from "./scan-network-dialog";

/**
 * Device list view — grid of device cards via {@link DataListView}.
 *
 * Uses `DataListView` with `layout="grid"` for consistent toolbar + state
 * handling. Each device renders as a {@link DeviceCard} via `renderCard`.
 */
export function DeviceListView() {
  const { _ } = useLingui();
  const {
    query: { isLoading, error },
    query,
    devices,
    search,
    handleSearchChange,
    hasActiveFilters,
    handleClearFilters,
  } = useDeviceList();

  const [scanOpen, setScanOpen] = useState(false);

  const hasDevices = (query.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={_(msg`Devices`)}
        description={_(msg`Manage your biometric attendance scanners.`)}
        actions={
          <>
            <Button
              onClick={() => setScanOpen(true)}
              variant="secondary"
              size="sm"
              icon={<IconRadar size={16} />}
            >
              {_(msg`Scan Network`)}
            </Button>
            <Button to={AppRoute.devices.new} size="sm" icon={<IconPlus size={16} />}>
              {_(msg`Add Device`)}
            </Button>
          </>
        }
      />

      <Section>
        <DataListView<DeviceSummary>
          layout="grid"
          entity="device"
          data={devices}
          getRowKey={(d) => d.serial_number}
          isLoading={isLoading}
          error={error?.message ?? null}
          onRetry={() => query.refetch()}
          searchPlaceholder={_(msg`Search by label, serial, or host…`)}
          searchValue={search}
          onSearchChange={handleSearchChange}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          resultCount={devices.length}
          renderCard={(device) => <DeviceCard device={device} />}
          emptyState={
            hasDevices ? (
              <EmptyState
                title={_(msg`No devices match`)}
                description={_(msg`Try adjusting or clearing your search.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No devices`)}
                description={_(msg`Add your first device or scan the network to discover ZKTeco scanners.`)}
                action={
                  <Button onClick={() => setScanOpen(true)} icon={<IconRadar size={16} />}>
                    {_(msg`Scan Network`)}
                  </Button>
                }
              />
            )
          }
        />
      </Section>

      <ScanNetworkDialog open={scanOpen} onClose={() => setScanOpen(false)} />
    </>
  );
}
