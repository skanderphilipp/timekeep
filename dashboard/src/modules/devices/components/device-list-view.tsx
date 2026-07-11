import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { useDeviceList } from "../hooks/use-device-list";
import {
  PageHeader,
  Section,
  Button,
  Spinner,
  EmptyState,
  FilterBar,
  FilterInput,
  CardGrid,
  PageError,
} from "@/components/ui";
import { DeviceCard } from "./device-card";

/**
 * Device list view — search filter, device cards, empty states.
 *
 * Owns all page state; the page composes this inside PageLayout.
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

  return (
    <>
      <PageHeader
        title={_(msg`Devices`)}
        description={_(msg`Manage your biometric attendance scanners.`)}
        actions={
          <Button to={AppRoute.devices.new} size="sm" icon={<IconPlus size={16} />}>
            {_(msg`Add Device`)}
          </Button>
        }
      />

      <Section>
        <FilterBar onClear={handleClearFilters} hasActiveFilters={hasActiveFilters}>
          <FilterInput
            placeholder={_(msg`Search devices…`)}
            value={search}
            onChange={handleSearchChange}
          />
        </FilterBar>
      </Section>

      <Section>
        {isLoading && <Spinner size="lg" />}

        {error && (
          <PageError onRetry={() => query.refetch()} message={_(msg`Failed to load devices.`)} />
        )}

        {!isLoading && !error && devices.length === 0 && (
          <EmptyState
            title={
              hasActiveFilters
                ? _(msg`No devices match your search`)
                : _(msg`No devices registered`)
            }
            description={
              hasActiveFilters
                ? _(msg`Try adjusting your search terms.`)
                : _(msg`Add your first biometric scanner to start collecting attendance data.`)
            }
            action={
              !hasActiveFilters ? (
                <Button to={AppRoute.devices.new} icon={<IconPlus size={16} />}>
                  {_(msg`Add Device`)}
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleClearFilters}>
                  {_(msg`Clear Filters`)}
                </Button>
              )
            }
          />
        )}

        {!isLoading && !error && devices.length > 0 && (
          <CardGrid>
            {devices.map((device) => (
              <DeviceCard key={device.serial_number} device={device} />
            ))}
          </CardGrid>
        )}
      </Section>
    </>
  );
}
