import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconUsers, IconDatabase, IconCpu, IconServer, IconFingerprint } from "@tabler/icons-react";

import { Grid, StatCard } from "@/components/ui";
import { calcStoragePct, calcUserPct } from "../utils/device-detail-utils";
import type { DeviceDetailResponse } from "@/lib/api";

type DeviceHealthCardsProps = {
  device: DeviceDetailResponse;
  hasStats: boolean;
};

/** Number of user capacity percent before storage bar variant switches. */
const STORAGE_CAPACITY_PCT = 100;

/**
 * Device health cards — stat card grid for Users, Records, Fingerprints,
 * Firmware, and Storage capacity.
 *
 * Pure presentational component driven by the {@link DeviceDetailResponse}.
 * All data derivation is delegated to pure utility functions for testability.
 * Renders {@link StatCard} components inside a {@link Grid}.
 */
export function DeviceHealthCards({ device, hasStats }: DeviceHealthCardsProps) {
  const { _ } = useLingui();
  const hasCapacity = hasStats && device.user_capacity > 0;
  const hasStorage = hasStats && device.record_capacity > 0;
  const hasFingerprint = hasStats && device.fingerprint_capacity > 0;

  const storagePct = hasStorage
    ? calcStoragePct(device.record_count, device.record_capacity)
    : 0;

  return (
    <Grid>
      <StatCard
        icon={<IconUsers size={20} />}
        label={_(msg`Users`)}
        value={hasCapacity ? `${device.user_count} / ${device.user_capacity}` : "—"}
        subtitle={
          hasCapacity
            ? `${calcUserPct(device.user_count, device.user_capacity).toFixed(1)}% used`
            : undefined
        }
        capacity={
          hasCapacity
            ? { current: device.user_count, max: device.user_capacity }
            : undefined
        }
      />

      <StatCard
        icon={<IconDatabase size={20} />}
        label={_(msg`Records`)}
        value={hasStats ? device.record_count.toLocaleString() : "—"}
      />

      {hasFingerprint && (
        <StatCard
          icon={<IconFingerprint size={20} />}
          label={_(msg`Fingerprints`)}
          value={`${device.fingerprint_count} / ${device.fingerprint_capacity}`}
          subtitle={`${((device.fingerprint_count / device.fingerprint_capacity) * STORAGE_CAPACITY_PCT).toFixed(1)}% used`}
          capacity={{
            current: device.fingerprint_count,
            max: device.fingerprint_capacity,
          }}
        />
      )}

      <StatCard
        icon={<IconCpu size={20} />}
        label={_(msg`Firmware`)}
        value={hasStats ? device.firmware_version || "—" : "—"}
      />

      <StatCard
        icon={<IconServer size={20} />}
        label={_(msg`Storage`)}
        value={hasStorage ? `${storagePct.toFixed(0)}%` : "—"}
        subtitle={
          hasStorage
            ? `${device.record_count.toLocaleString()} / ${device.record_capacity.toLocaleString()}`
            : undefined
        }
        capacity={
          hasStorage
            ? { current: device.record_count, max: device.record_capacity }
            : undefined
        }
      />
    </Grid>
  );
}
