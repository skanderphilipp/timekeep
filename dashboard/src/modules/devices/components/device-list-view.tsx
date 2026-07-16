import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconRadar, IconRefresh } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useDeviceList } from "../hooks/use-device-list";
import { Section, Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView } from "@/modules/data-renderer";
import { useOpenRecordInSidePanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useToast } from "@/infrastructure/toast/toast";
import { syncAllDevices } from "@/lib/api";
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

  const openRecord = useOpenRecordInSidePanel();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [scanOpen, setScanOpen] = useState(false);

  const syncAll = useMutation({
    mutationFn: syncAllDevices,
    onSuccess: () => {
      toast.success(_(msg`Sync started for all devices.`));
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: () => {
      toast.error(_(msg`Failed to start sync.`));
    },
  });

  const handleAddDevice = useCallback(() => {
    openRecord({
      entityType: "device",
      title: _(msg`Register Device`),
      isNewRecord: true,
    });
  }, [openRecord, _]);

  const hasDevices = (query.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={_(msg`Devices`)}
        description={_(msg`Manage your biometric attendance scanners.`)}
        actions={
          <>
            <Button
              onClick={() => syncAll.mutate()}
              variant="secondary"
              size="sm"
              icon={<IconRefresh size={16} />}
              disabled={syncAll.isPending || !hasDevices}
            >
              {syncAll.isPending ? _(msg`Syncing…`) : _(msg`Sync All`)}
            </Button>
            <Button
              onClick={() => setScanOpen(true)}
              variant="secondary"
              size="sm"
              icon={<IconRadar size={16} />}
            >
              {_(msg`Scan Network`)}
            </Button>
            <Button onClick={handleAddDevice} size="sm" icon={<IconPlus size={16} />}>
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
