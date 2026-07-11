import { useCallback, type ChangeEvent } from "react";

import { toDateString } from "@/lib/date";

type FilterPatch = Record<string, unknown>;

/**
 * Simple change handlers for the punch filter bar controls.
 */
export function usePunchFilterHandlers(
  handleFilterChange: (patch: FilterPatch) => void,
  setDeviceSns: (sns: string[]) => void,
) {
  const handleDateChange = useCallback(
    (from: Date | null, to: Date | null | undefined) => {
      handleFilterChange({
        since: from ? toDateString(from) : undefined,
        until: to ? toDateString(to) : undefined,
      });
    },
    [handleFilterChange],
  );

  /** Unified search across employee name + PIN. */
  const handleSearchChange = useCallback(
    (v: string) => handleFilterChange({ user_pin: v || undefined }),
    [handleFilterChange],
  );

  /** Single device select (legacy; maps to device_sns array). */
  const handleDeviceChange = useCallback(
    (v: string) => {
      // Update URL-synced single device
      handleFilterChange({ device_sn: v || undefined });
      // Update local multi-device state
      setDeviceSns(v ? [v] : []);
    },
    [handleFilterChange, setDeviceSns],
  );

  const handleStatusChange = useCallback(
    (v: string) => handleFilterChange({ status: v || undefined }),
    [handleFilterChange],
  );

  const handleAnomaliesOnlyToggle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) =>
      handleFilterChange({ anomalies_only: e.target.checked ? "true" : undefined }),
    [handleFilterChange],
  );

  return {
    handleDateChange,
    handleSearchChange,
    handleDeviceChange,
    handleStatusChange,
    handleAnomaliesOnlyToggle,
  };
}
