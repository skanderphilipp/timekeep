import { useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
 * - Changing filters or sort resets the page to 1 (atomically, in a single
 *   `setSearchParams` call to avoid race conditions).
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
 * ```
 */
export function useListState<T extends FilterValues>({
  namespace,
  filterDefaults,
  sortDefaults = null,
  defaultPage = 1,
}: ListStateOptions<T>) {
  const [, setSearchParams] = useSearchParams();

  const {
    filters,
    resetFilters: _resetFilters,
    hasActiveFilters,
  } = useFilterUrl<T>({
    namespace,
    defaults: filterDefaults,
  });

  const { sort, toggleSort: _toggleSort } = useSortUrl({
    namespace,
    defaultSort: sortDefaults,
  });

  const { page, setPage: _setPage } = usePageUrl({
    namespace,
    defaultPage,
  });

  // ── Parameter key helpers ──────────────────────────────────────────

  const pageParam = `${namespace}_page`;
  const sortParam = `${namespace}_sort`;
  const orderParam = `${namespace}_order`;

  /**
   * Build a filter param key for the given field name.
   */
  const filterKey = (field: string) => `${namespace}_${field}`;

  /**
   * Set filter values AND reset page to 1 atomically.
   *
   * The page reset was previously a separate `setSearchParams` call,
   * which raced with the filter update and caused filter changes to be
   * silently dropped (React Router's `replace: true` batching).
   */
  const setFilter = useCallback(
    (update: Partial<T>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          for (const [key, value] of Object.entries(update) as [string, string | undefined][]) {
            const paramKey = filterKey(key);
            const defaultVal = (filterDefaults as Record<string, string | undefined>)[key];
            if (value === undefined || value === "" || value === defaultVal) {
              next.delete(paramKey);
            } else {
              next.set(paramKey, value);
            }
          }

          // Reset page to 1 (filters changed → start from first page)
          next.set(pageParam, String(defaultPage));

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, namespace, filterDefaults, pageParam, defaultPage],
  );

  /**
   * Set sort state AND reset page to 1 atomically.
   */
  const setSort = useCallback(
    (next: SortField | null) => {
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          if (next) {
            nextParams.set(sortParam, next.column);
            nextParams.set(orderParam, next.direction);
          } else {
            nextParams.delete(sortParam);
            nextParams.delete(orderParam);
          }
          nextParams.set(pageParam, String(defaultPage));
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams, sortParam, orderParam, pageParam, defaultPage],
  );

  /**
   * Toggle sort column AND reset page to 1 atomically.
   */
  const toggleSort = useCallback(
    (column: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const currentCol = prev.get(sortParam);
          const currentDir = prev.get(orderParam);

          if (!currentCol || currentCol !== column) {
            next.set(sortParam, column);
            next.set(orderParam, "asc");
          } else if (currentDir === "asc") {
            next.set(sortParam, column);
            next.set(orderParam, "desc");
          } else {
            next.delete(sortParam);
            next.delete(orderParam);
          }

          next.set(pageParam, String(defaultPage));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, sortParam, orderParam, pageParam, defaultPage],
  );

  /**
   * Reset all filters to defaults AND reset page to 1 atomically.
   */
  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(filterDefaults)) {
          next.delete(filterKey(key));
        }
        next.set(pageParam, String(defaultPage));
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, namespace, filterDefaults, pageParam, defaultPage]);

  /**
   * Stable query key array for TanStack Query.
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
