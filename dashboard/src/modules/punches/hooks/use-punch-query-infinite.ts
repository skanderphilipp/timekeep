import { useMemo, useCallback, useState } from "react";

import type { PunchFilter } from "@/lib/api";
import { useListState } from "@/infrastructure/query-params";
import { useInfinitePunchData, type Punch } from "./use-punch-data-infinite";

const punchFilterDefaults: Omit<
  PunchFilter,
  "limit" | "offset" | "order_desc" | "cursor" | "sort_by" | "device_sns"
> = {
  device_sn: "",
  user_pin: "",
  status: "",
  verify_mode: "",
  anomalies_only: "",
  since: "",
  until: "",
};

/**
 * Infinite scroll punch query — cursor-based infinite loading.
 *
 * Sort state (column + direction) is synced to the URL via useListState.
 * Multi-device (`device_sns`) is managed separately via local state because
 * arrays don't fit the string-only URL filter infrastructure.
 */
export function useInfinitePunchQuery() {
  const { filters, sort, setFilter, toggleSort, resetFilters, hasActiveFilters } = useListState<
    Omit<PunchFilter, "limit" | "offset" | "order_desc" | "cursor" | "sort_by" | "device_sns">
  >({
    namespace: "punches",
    filterDefaults: punchFilterDefaults,
    sortDefaults: { column: "timestamp", direction: "desc" },
  });

  // Multi-device filter managed outside URL sync (arrays not supported by FilterValues)
  const [deviceSns, setDeviceSns] = useState<string[]>([]);

  /** Merge URL filter state + local multi-device state + sort into API shape. */
  const apiFilter = useMemo<Omit<PunchFilter, "limit" | "offset" | "cursor">>(
    () => ({
      ...filters,
      device_sns: deviceSns.length > 0 ? deviceSns : undefined,
      sort_by: sort?.column,
      order_desc: sort?.direction === "desc" ? true : sort ? false : undefined,
    }),
    [filters, deviceSns, sort],
  );

  const query = useInfinitePunchData(apiFilter);

  const punches: Punch[] = useMemo(
    () => query.data?.pages.flatMap((page) => page.punches) ?? [],
    [query.data],
  );

  const handleSortChange = useCallback((columnId: string) => toggleSort(columnId), [toggleSort]);

  const handleFilterChange = useCallback(
    (
      patch: Partial<
        Omit<PunchFilter, "limit" | "offset" | "order_desc" | "cursor" | "sort_by" | "device_sns">
      >,
    ) => setFilter(patch),
    [setFilter],
  );

  const handleClearFilters = useCallback(() => {
    resetFilters();
    setDeviceSns([]);
  }, [resetFilters]);

  return {
    filters: { ...filters, device_sns: deviceSns.length > 0 ? deviceSns : undefined } as Omit<
      PunchFilter,
      "limit" | "offset" | "order_desc" | "cursor" | "sort_by"
    >,
    sortState: sort ? { column: sort.column, direction: sort.direction } : null,
    punches,
    query,
    hasActiveFilters: hasActiveFilters || deviceSns.length > 0,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error ? String(query.error) : null,
    handleSortChange,
    handleFilterChange,
    setDeviceSns,
    handleClearFilters,
  };
}
