import { useMemo, useCallback } from "react";
import type { FilterValues, ListStateOptions, SortField } from "./types";
import { useFilterUrl } from "./use-filter-url";
import { useSortUrl } from "./use-sort-url";
import { usePageUrl } from "./use-page-url";

/**
 * Composite hook: filter + sort + pagination, all synced to URL.
 *
 * This is the primary hook for any list page. It combines three URL-synced
 * state slices and provides a stable `queryKey` for TanStack Query.
 *
 * Key behavior:
 * - Changing filters or sort resets the page to 1 (via wrapped setters).
 * - `queryKey` changes whenever any state slice changes → auto-refetch.
 *
 * @example
 * ```ts
 * const { filters, setFilter, sort, toggleSort, page, setPage, queryKey, ... } =
 *   useListState({
 *     namespace: "punches",
 *     filterDefaults: { device_sn: "", user_pin: "", since: "", until: "" },
 *     sortDefaults: { column: "timestamp", direction: "desc" },
 *   });
 *
 * // Pass queryKey to TanStack Query:
 * const query = useQuery({ queryKey, queryFn: () => fetchData(filters, sort, page) });
 * ```
 */
export function useListState<T extends FilterValues>({
  namespace,
  filterDefaults,
  sortDefaults = null,
  defaultPage = 1,
}: ListStateOptions<T>) {
  const {
    filters,
    setFilter: _setFilter,
    resetFilters: _resetFilters,
    hasActiveFilters,
  } = useFilterUrl<T>({
    namespace,
    defaults: filterDefaults,
  });

  const {
    sort,
    setSort: _setSort,
    toggleSort: _toggleSort,
  } = useSortUrl({
    namespace,
    defaultSort: sortDefaults,
  });

  const {
    page,
    setPage: _setPage,
    resetPage,
  } = usePageUrl({
    namespace,
    defaultPage,
  });

  // ── Wrapped setters that reset page to 1 ────────────────────────

  const setFilter = useCallback(
    (update: Partial<T>) => {
      _setFilter(update);
      resetPage();
    },
    [_setFilter, resetPage],
  );

  const setSort = useCallback(
    (next: SortField | null) => {
      _setSort(next);
      resetPage();
    },
    [_setSort, resetPage],
  );

  const toggleSort = useCallback(
    (column: string) => {
      _toggleSort(column);
      resetPage();
    },
    [_toggleSort, resetPage],
  );

  const resetFilters = useCallback(() => {
    _resetFilters();
    resetPage();
  }, [_resetFilters, resetPage]);

  /**
   * Stable query key array for TanStack Query.
   *
   * Includes namespace + all filter values + sort + page so that any
   * change triggers a fresh query automatically.
   */
  const queryKey = useMemo(
    () => [
      namespace,
      ...Object.entries(filters).flatMap(([k, v]) => [k, v ?? ""]),
      sort ? `${sort.column}:${sort.direction}` : "",
      `page:${page}`,
    ],
    [namespace, filters, sort, page],
  );

  return {
    /** Current filter values (from URL). */
    filters,
    /** Merge partial updates into filters (synced to URL, resets page). */
    setFilter,
    /** Reset all filters to defaults (clears URL params, resets page). */
    resetFilters,
    /** Whether any filter differs from its default. */
    hasActiveFilters,
    /** Current sort state or null if unsorted. */
    sort,
    /** Set a specific sort column + direction (resets page). */
    setSort,
    /** Toggle sort: none → asc → desc → none (resets page). */
    toggleSort,
    /** Current page number (≥ 1). */
    page,
    /** Navigate to a specific page (does NOT reset filters/sort). */
    setPage: _setPage,
    /** TanStack Query key — include in `queryKey` to auto-refetch on changes. */
    queryKey,
  } as const;
}
