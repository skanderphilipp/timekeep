import { useMemo, useCallback, useState, type ChangeEvent } from "react";
import { useLingui } from "@lingui/react";

import { useInfinitePunchQuery } from "./use-punch-query-infinite";
import { useActivePunchFilters } from "./use-active-punch-filters";
import { useAttendancePresets } from "./use-attendance-presets";
import { usePunchFacetOptions } from "./use-punch-facet-options";
import { createPunchColumns } from "@/modules/data-renderer/column-definitions/punch-columns";
import { fromDateString, toDateString } from "@/lib/date";
import type { Punch, FacetFilterParams } from "@/lib/api";
import type { ColumnDefinition } from "@/modules/data-renderer/types";

/** Columns that are always visible and cannot be toggled off. */
const REQUIRED_COLUMNS = ["timestamp"];

/**
 * Page-level orchestration hook for the Punch Query page.
 *
 * Composes data fetching, filter state, active filter display, date presets,
 * column definitions, column visibility, facet-powered options, and all
 * derived values into a single consumable return.
 */
export function usePunchQueryPage() {
  const { _ } = useLingui();

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
    setDeviceSns,
    handleClearFilters,
  } = useInfinitePunchQuery();

  const allColumns = useMemo(() => createPunchColumns(_), [_]);
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
        handleFilterChange({ device_sn: (sns && sns.length === 1) ? sns[0] : undefined } as any);
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

  /** Track which optional columns the user has hidden. */
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  /** Columns currently visible (respects user toggles + required columns). */
  const columns: ColumnDefinition[] = useMemo(
    () =>
      allColumns.map((col) => ({
        ...col,
        isVisible: REQUIRED_COLUMNS.includes(col.id) ? true : !hiddenColumns.has(col.id),
      })),
    [allColumns, hiddenColumns],
  );

  /** Options for the column visibility MultiSelect. */
  const columnOptions = useMemo(
    () =>
      allColumns
        .filter((col) => !REQUIRED_COLUMNS.includes(col.id))
        .map((col) => ({ value: col.id, label: col.header })),
    [allColumns],
  );

  /** Currently selected (visible) column IDs for the MultiSelect. */
  const visibleColumnIds = useMemo(
    () => columns.filter((c) => c.isVisible).map((c) => c.id),
    [columns],
  );

  const handleColumnToggle = useCallback((selectedIds: string[]) => {
    const visibleSet = new Set(selectedIds);
    setHiddenColumns(
      new Set(allColumns.filter((c) => !REQUIRED_COLUMNS.includes(c.id) && !visibleSet.has(c.id)).map((c) => c.id)),
    );
  }, [allColumns]);

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

  const anomaliesOnly = filters.anomalies_only === "true";
  const handleAnomaliesOnlyToggle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => handleFilterChange({ anomalies_only: e.target.checked ? "true" : undefined }),
    [handleFilterChange],
  );

  /** Count of anomalies in the currently loaded punches. */
  const anomalyCount = useMemo(
    () => punches.filter((p) => p.is_anomaly).length,
    [punches],
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
    handleAnomaliesOnlyToggle,
    refetch: () => query.refetch(),
  };
}
