import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListState, type FilterValues } from "@/infrastructure/query-params";
import { fetchDevices, type DeviceSummary } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

// ── Filter defaults ────────────────────────────────────────────────────

const deviceFilterDefaults: FilterValues = {
  search: "",
};

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Device list query hook with URL-synced filtering and sorting.
 *
 * Uses `useListState` for URL-based filter/search state persistence.
 * The search filter performs client-side filtering on the full device list.
 * Sorting is also client-side since the current `GET /api/devices` endpoint
 * returns all devices without server-side pagination.
 */
export function useDeviceList() {
  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    sort,
    toggleSort,
    queryKey: _queryKey,
  } = useListState({
    namespace: "devices",
    filterDefaults: deviceFilterDefaults,
    sortDefaults: { column: "label", direction: "asc" },
  });

  // Fetch full device list (no server-side filtering yet)
  const query = useQuery({
    queryKey: QueryKeys.devices.list(),
    queryFn: fetchDevices,
  });

  // ── Client-side filter + sort ──────────────────────────────────

  const filtered = useMemo(() => {
    const all = query.data ?? [];
    const search = (filters.search ?? "").toLowerCase().trim();

    let result = all;
    if (search) {
      result = all.filter(
        (d) =>
          d.label?.toLowerCase().includes(search) ||
          d.serial_number?.toLowerCase().includes(search) ||
          d.host?.toLowerCase().includes(search),
      );
    }

    // Client-side sort
    if (sort) {
      const dir = sort.direction === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        const aVal = getSortValue(a, sort.column);
        const bVal = getSortValue(b, sort.column);
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }

    return result;
  }, [query.data, filters.search, sort]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleSearchChange = useCallback((search: string) => setFilter({ search }), [setFilter]);

  const handleClearFilters = useCallback(() => resetFilters(), [resetFilters]);

  return {
    /** Raw query result (loading, error, etc.). */
    query,
    /** Filtered + sorted device list. */
    devices: filtered,
    /** Total count before filtering. */
    totalCount: query.data?.length ?? 0,
    /** Current search term. */
    search: filters.search ?? "",
    /** Update search term (synced to URL). */
    handleSearchChange,
    /** Current sort state. */
    sort,
    /** Toggle sort column. */
    toggleSort,
    /** Whether any filter is active. */
    hasActiveFilters,
    /** Reset all filters to defaults. */
    handleClearFilters,
  } as const;
}

// ── Helpers ────────────────────────────────────────────────────────────

function getSortValue(device: DeviceSummary, column: string): string {
  switch (column) {
    case "serial_number":
      return device.serial_number;
    case "host":
      return device.host;
    case "label":
    default:
      return device.label;
  }
}
