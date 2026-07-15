import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconRadar } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { useDeviceList } from "../hooks/use-device-list";
import { Section, Button, FilterBar, SearchInput, Grid } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import type { DeviceSummary } from "@/lib/api";
import { DeviceCard } from "./device-card";
import { ScanNetworkDialog } from "./scan-network-dialog";
import { DeviceListLoading, DeviceListError, DeviceListEmpty } from "../states";

/**
 * Device list view — search filter, device cards, and network scan.
 *
 * Uses `DataBoundary` for consistent loading → error → empty → data
 * state rendering. UI state (scanOpen) stays local via `useState`.
 * All business logic lives in `useDeviceList`.
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
        <FilterBar onClear={handleClearFilters} hasActiveFilters={hasActiveFilters}>
          <SearchInput
            placeholder={_(msg`Search devices…`)}
            value={search}
            onChange={handleSearchChange}
            debounceMs={300}
          />
        </FilterBar>
      </Section>

      <Section>
        <DataBoundary<DeviceSummary>
          data={query.data ? devices : undefined}
          isLoading={isLoading}
          error={error ?? null}
          onRetry={() => query.refetch()}
          loadingFallback={<DeviceListLoading />}
          errorFallback={<DeviceListError onRetry={() => query.refetch()} />}
          emptyFallback={
            <DeviceListEmpty
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
              onScanNetwork={() => setScanOpen(true)}
            />
          }
        >
          {(deviceList) => (
            <Grid>
              {deviceList.map((device) => (
                <DeviceCard key={device.serial_number} device={device} />
              ))}
            </Grid>
          )}
        </DataBoundary>
      </Section>

      <ScanNetworkDialog open={scanOpen} onClose={() => setScanOpen(false)} />
    </>
  );
}
