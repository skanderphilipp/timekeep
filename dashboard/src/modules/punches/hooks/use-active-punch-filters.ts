import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import type { ActiveFilter } from "@/components/ui/filter-bar";
import type { PunchFilter } from "@/lib/api";

type FilterPatch = Partial<Omit<PunchFilter, "limit" | "offset" | "order_desc" | "cursor" | "sort_by">>;

/**
 * Converts raw punch filter state into ActiveFilter objects for display
 * in the FilterBar chip area.
 *
 * Uses device labels (from facet data) instead of raw serial numbers
 * so chips are human-readable. Supports multi-device filtering.
 */
export function useActivePunchFilters(
  filters: FilterPatch,
  onFilterChange: (patch: FilterPatch) => void,
  /** Optional lookup: device SN → human-readable label. */
  deviceLabelBySn?: Map<string, string>,
): ActiveFilter[] {
  const { _ } = useLingui();

  return useMemo(() => {
    const result: ActiveFilter[] = [];

    if (filters.user_pin) {
      result.push({
        key: "user_pin",
        label: `${_(msg`Search`)}: ${filters.user_pin}`,
        onRemove: () => onFilterChange({ user_pin: undefined }),
      });
    }

    // Multi-device chips
    const deviceSns = filters.device_sns ?? (filters.device_sn ? [filters.device_sn] : []);
    for (const sn of deviceSns) {
      const label = deviceLabelBySn?.get(sn) ?? sn;
      result.push({
        key: `device_${sn}`,
        label: `${_(msg`Device`)}: ${label}`,
        onRemove: () => {
          const remaining = deviceSns.filter((s) => s !== sn);
          onFilterChange({
            device_sns: remaining.length > 0 ? remaining : undefined,
            device_sn: remaining.length === 1 ? remaining[0] : undefined,
          });
        },
      });
    }

    if (filters.since) {
      result.push({
        key: "since",
        label: `${_(msg`From`)} ${filters.since}`,
        onRemove: () => onFilterChange({ since: undefined }),
      });
    }

    if (filters.until) {
      result.push({
        key: "until",
        label: `${_(msg`To`)} ${filters.until}`,
        onRemove: () => onFilterChange({ until: undefined }),
      });
    }

    if (filters.status) {
      result.push({
        key: "status",
        label: `${_(msg`Status`)}: ${filters.status}`,
        onRemove: () => onFilterChange({ status: undefined }),
      });
    }

    if (filters.anomalies_only) {
      result.push({
        key: "anomalies_only",
        label: _(msg`Anomalies only`),
        onRemove: () => onFilterChange({ anomalies_only: undefined }),
      });
    }

    return result;
  }, [filters, onFilterChange, deviceLabelBySn, _]);
}
