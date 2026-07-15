import { useMemo, useCallback } from "react";

import { useInfinitePunchQuery } from "./use-punch-query-infinite";
import { useActivePunchFilters } from "./use-active-punch-filters";
import { useAttendancePresets } from "./use-attendance-presets";
import { usePunchFacetOptions } from "./use-punch-facet-options";
import { usePunchColumns } from "./use-punch-columns";
import { usePunchFilterHandlers } from "./use-punch-filter-handlers";
import { fromDateString } from "@/lib/date";
import type { Punch, FacetFilterParams } from "@/lib/api";

/**
 * Page-level orchestration hook for the Punch Query page.
 *
 * Composes data fetching, filter state, active filter display, date presets,
 * column definitions, column visibility, facet-powered options, and all
 * derived values into a single consumable return.
 */
export function usePunchQueryPage() {
  const {
    filters,
    punches,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    query,
    hasActiveFilters,
    handleSortChange,
    handleFilterChange,
    deviceSns,
    setDeviceSns,
    handleClearFilters,
  } = useInfinitePunchQuery();

  const { columns, columnOptions, visibleColumnIds, handleColumnToggle } = usePunchColumns();
  const presets = useAttendancePresets();

  // ── Facet-powered options (contextual counts) ─────────────────────

  /** Build facet context from current filters for contextual counts. */
  const facetContext = useMemo<FacetFilterParams>(() => {
    const ctx: FacetFilterParams = {};
    if (filters.since) ctx.since = filters.since;
    if (filters.until) ctx.until = filters.until;
    if (filters.status) ctx.status = filters.status;
    if (filters.device_sns) ctx.device_sns = filters.device_sns;
    return ctx;
  }, [filters.since, filters.until, filters.status, filters.device_sns]);

  const facetOptions = usePunchFacetOptions(facetContext);

  /** Filter change handler that routes device_sns updates to local state. */
  const handleFilterChangeWithDevices = useCallback(
    (patch: Record<string, unknown>) => {
      if ("device_sns" in patch) {
        const sns = patch.device_sns as string[] | undefined;
        setDeviceSns(sns ?? []);
        // Also update single device_sn for URL sync
        handleFilterChange({ device_sn: sns && sns.length === 1 ? sns[0] : undefined } as any);
      } else {
        handleFilterChange(patch as any);
      }
    },
    [handleFilterChange, setDeviceSns],
  );

  const activeFilters = useActivePunchFilters(
    filters,
    handleFilterChangeWithDevices,
    facetOptions.labelBySn,
  );

  /** Pre-computed Date values so the page never touches date strings. */
  const dateFrom = useMemo(
    () => (filters.since ? fromDateString(filters.since) : null),
    [filters.since],
  );
  const dateTo = useMemo(
    () => (filters.until ? fromDateString(filters.until) : null),
    [filters.until],
  );

  /** Stable row key extractor. */
  const getRowKey = useCallback((punch: Punch) => punch.id, []);

  const {
    handleDateChange,
    handleSearchChange,
    handleDeviceChange,
    handleStatusChange,
    handleVerifyModeChange,
    handleAnomaliesOnlyToggle,
  } = usePunchFilterHandlers(handleFilterChange, setDeviceSns);

  const anomaliesOnly = filters.anomalies_only === "true";

  /** Count of anomalies in the currently loaded punches. */
  const anomalyCount = useMemo(() => punches.filter((p) => p.is_anomaly).length, [punches]);

  /** Unified search bar value: the active `search` or `user_pin` filter. */
  const searchValue = useMemo(
    () => (filters.search ?? filters.user_pin ?? ""),
    [filters.search, filters.user_pin],
  );

  return {
    columns,
    columnOptions,
    visibleColumnIds,
    handleColumnToggle,
    presets,
    activeFilters,
    facetOptions,
    filters,
    searchValue,
    dateFrom,
    dateTo,
    punches,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    hasActiveFilters,
    anomalyCount,
    anomaliesOnly,
    getRowKey,
    handleSortChange,
    handleClearFilters,
    handleDateChange,
    handleSearchChange,
    handleDeviceChange,
    handleStatusChange,
    handleVerifyModeChange,
    handleAnomaliesOnlyToggle,
    deviceSns,
    setDeviceSns,
    refetch: () => query.refetch(),
  };
}
