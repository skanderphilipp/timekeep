import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import type { ActiveFilter } from "@/components/ui/filter-bar";
import type { PunchFilter } from "@/lib/api";

type FilterPatch = Partial<
  Omit<PunchFilter, "limit" | "offset" | "order_desc" | "cursor" | "sort_by">
>;

/** Human-readable labels for verify_mode values. */
const VERIFY_MODE_LABELS: Record<string, string> = {
  fingerprint: "Fingerprint",
  face: "Face",
  card: "RF Card",
  password: "Password",
  palm: "Palm",
};

/**
 * Converts raw punch filter state into ActiveFilter objects for display
 * in the FilterBar chip area.
 *
 * Each chip carries a semantic color so different filter categories are
 * visually distinguishable at a glance.
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

		// Search — PIN exact match (digit-only input)
		if (filters.user_pin) {
			result.push({
				key: "user_pin",
				label: `${_(msg`PIN`)}: ${filters.user_pin}`,
				color: "accent",
				onRemove: () => onFilterChange({ user_pin: undefined, search: undefined }),
			});
		}

		// Search — full-text (name or mixed input)
		if (filters.search) {
			result.push({
				key: "search",
				label: `${_(msg`Search`)}: ${filters.search}`,
				color: "accent",
				onRemove: () => onFilterChange({ search: undefined, user_pin: undefined }),
			});
		}

    // Multi-device chips
    const deviceSns = filters.device_sns ?? (filters.device_sn ? [filters.device_sn] : []);
    for (const sn of deviceSns) {
      const label = deviceLabelBySn?.get(sn) ?? sn;
      result.push({
        key: `device_${sn}`,
        label: `${_(msg`Device`)}: ${label}`,
        color: "green",
        onRemove: () => {
          const remaining = deviceSns.filter((s) => s !== sn);
          onFilterChange({
            device_sns: remaining.length > 0 ? remaining : undefined,
            device_sn: remaining.length === 1 ? remaining[0] : undefined,
          });
        },
      });
    }

    // Date range
    if (filters.since) {
      result.push({
        key: "since",
        label: `${_(msg`From`)} ${filters.since}`,
        color: "gray",
        onRemove: () => onFilterChange({ since: undefined }),
      });
    }

    if (filters.until) {
      result.push({
        key: "until",
        label: `${_(msg`To`)} ${filters.until}`,
        color: "gray",
        onRemove: () => onFilterChange({ until: undefined }),
      });
    }

    // Status
    if (filters.status) {
      result.push({
        key: "status",
        label: `${_(msg`Status`)}: ${filters.status}`,
        color: "green",
        onRemove: () => onFilterChange({ status: undefined }),
      });
    }

    // Verification method
    if (filters.verify_mode) {
      const label = VERIFY_MODE_LABELS[filters.verify_mode] ?? filters.verify_mode;
      result.push({
        key: "verify_mode",
        label: `${_(msg`Method`)}: ${label}`,
        color: "blue",
        onRemove: () => onFilterChange({ verify_mode: undefined }),
      });
    }

    // Anomalies toggle
    if (filters.anomalies_only) {
      result.push({
        key: "anomalies_only",
        label: _(msg`Anomalies only`),
        color: "amber",
        onRemove: () => onFilterChange({ anomalies_only: undefined }),
      });
    }

    return result;
  }, [filters, onFilterChange, deviceLabelBySn, _]);
}
