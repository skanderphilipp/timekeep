import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconRadar } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { EmptyState, Button } from "@/components/ui";

type DeviceListEmptyProps = {
  /** Whether a search/filter is active (changes the empty message). */
  hasActiveFilters: boolean;
  /** Called to clear all active filters. */
  onClearFilters: () => void;
  /** Called to open the network scan dialog. */
  onScanNetwork: () => void;
};

/**
 * Empty state for the device list.
 *
 * Shows contextual messaging depending on whether filters are active:
 * - Filtered: "No devices match your search" + clear filters button
 * - Unfiltered: "No devices registered" + add device / scan network CTAs
 *
 * Use as the `emptyFallback` prop of `DataBoundary`.
 */
export function DeviceListEmpty({
  hasActiveFilters,
  onClearFilters,
  onScanNetwork,
}: DeviceListEmptyProps) {
  const { _ } = useLingui();

  if (hasActiveFilters) {
    return (
      <EmptyState
        title={_(msg`No devices match your search`)}
        description={_(msg`Try adjusting your search terms.`)}
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            {_(msg`Clear Filters`)}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title={_(msg`No devices registered`)}
      description={_(msg`Add your first biometric scanner to start collecting attendance data.`)}
      action={
        <>
          <Button to={AppRoute.devices.new} icon={<IconPlus size={16} />}>
            {_(msg`Add Device`)}
          </Button>
          <Button onClick={onScanNetwork} variant="secondary" icon={<IconRadar size={16} />}>
            {_(msg`Scan Network`)}
          </Button>
        </>
      }
    />
  );
}
