import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import type { PunchFilter } from "@/lib/api";
import { useListState } from "@/infrastructure/query-params";
import { useInfinitePunchData, type Punch } from "./use-punch-data-infinite";
import { toDateString } from "@/lib/date";

const punchFilterDefaults: Omit<
  PunchFilter,
  "limit" | "offset" | "order_desc" | "cursor" | "sort_by" | "device_sns" | "user_pins"
> = {
  search: "",
  status: "",
  verify_mode: "",
  anomalies_only: "",
  since: "",
  until: "",
};

/**
 * Infinite scroll punch query -- cursor-based infinite loading.
 *
 * Sort state (column + direction) is synced to the URL via useListState.
 * Multi-device (`device_sns`) and user PINs (`user_pins`) are managed
 * via local state because the URL filter infrastructure only supports
 * flat string values, not arrays.
 *
 * On first load with no date range, defaults to today so the table,
 * timeline, date picker, and filter chips all agree on the active range.
 * After clearing filters, the date range resets to today as well.
 */
export function useInfinitePunchQuery() {
  const { filters, sort, setFilter, toggleSort, resetFilters, hasActiveFilters } = useListState<
    Omit<PunchFilter, "limit" | "offset" | "order_desc" | "cursor" | "sort_by" | "device_sns" | "user_pins">
  >({
    namespace: "punches",
    filterDefaults: punchFilterDefaults,
    sortDefaults: { column: "timestamp", direction: "desc" },
  });

  // Multi-device filter managed outside URL sync (arrays not supported by FilterValues)
  const [deviceSns, setDeviceSns] = useState<string[]>([]);

  // User PIN filter managed outside URL sync (same reason as device_sns)
  const [userPins, setUserPins] = useState<string[]>([]);

  // -- Default to today on first load --

  const initializedRef = useRef(false);

  useEffect(() => {
    // Mark as initialized immediately, regardless of whether we set a default.
    // This prevents the today-default from re-triggering after clearFilters().
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!filters.since && !filters.until) {
      const today = toDateString(new Date());
      setFilter({ since: today, until: today });
    }
  }, [filters.since, filters.until, setFilter]);

  // -- Read device_sns / user_pins from URL on mount (navigation helpers) --

  const initializedUrlParamsRef = useRef(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (initializedUrlParamsRef.current) return;
    initializedUrlParamsRef.current = true;

    const urlDeviceSns = searchParams.get("punches_device_sns");
    if (urlDeviceSns && !deviceSns.length) {
      setDeviceSns(urlDeviceSns.split(",").filter(Boolean));
    }
    const urlUserPins = searchParams.get("punches_user_pins");
    if (urlUserPins && !userPins.length) {
      setUserPins(urlUserPins.split(",").filter(Boolean));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Merge URL filter state + local multi-device state + sort into API shape. */
  const apiFilter = useMemo<Omit<PunchFilter, "limit" | "offset" | "cursor">>(
    () => ({
      ...filters,
      device_sns: deviceSns.length > 0 ? deviceSns : undefined,
      user_pins: userPins.length > 0 ? userPins : undefined,
      sort_by: sort?.column,
      sort_order: sort?.direction,
    }),
    [filters, deviceSns, userPins, sort],
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
        Omit<PunchFilter, "limit" | "offset" | "order_desc" | "cursor" | "sort_by" | "user_pins"> & { user_pins?: string[] }
      >,
    ) => {
      // Route user_pins to local state (array). URL stores comma-separated string.
      // Use "in" check so explicit `undefined` (clearing) also hits this branch.
      if ("user_pins" in patch) {
        const { user_pins: pins, ...rest } = patch;
        setUserPins(pins ?? []);
        setFilter(rest);
      } else {
        setFilter(patch);
      }
    },
    [setFilter],
  );

  const handleClearFilters = useCallback(() => {
    resetFilters();
    setDeviceSns([]);
    setUserPins([]);
  }, [resetFilters]);

  return {
    filters: {
      ...filters,
      device_sns: deviceSns.length > 0 ? deviceSns : undefined,
      user_pins: userPins.length > 0 ? userPins : undefined,
    } as Omit<
      PunchFilter,
      "limit" | "offset" | "order_desc" | "cursor" | "sort_by"
    >,
    sortState: sort ? { column: sort.column, direction: sort.direction } : null,
    punches,
    query,
    hasActiveFilters: hasActiveFilters || deviceSns.length > 0 || userPins.length > 0,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error ? String(query.error) : null,
    handleSortChange,
    handleFilterChange,
    deviceSns,
    setDeviceSns,
    handleClearFilters,
  };
}
