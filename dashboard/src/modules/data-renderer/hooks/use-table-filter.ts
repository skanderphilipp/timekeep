import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";

import { tableFilterFamilyState } from "../states/atoms/filter-state";
import type { FilterEntry } from "../types";

/**
 * Hook: table filter state + handlers for a given table instance.
 *
 * Automatically cleans up the atom family cache entry on unmount
 * to prevent memory leaks from stale table instances.
 */
export function useTableFilter(instanceId: string) {
  const filters = useAtomValue(tableFilterFamilyState(instanceId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setFilters = useSetAtom(tableFilterFamilyState(instanceId) as any);

  // ── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      tableFilterFamilyState.remove(instanceId);
    };
  }, [instanceId]);

  const setFilter = useCallback(
    (entry: FilterEntry) => {
      setFilters((prev: FilterEntry[]) => {
        const idx = prev.findIndex((f: FilterEntry) => f.columnId === entry.columnId);
        if (idx >= 0) {
          if (entry.value === "") {
            return prev.filter((_: FilterEntry, i: number) => i !== idx);
          }
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        if (entry.value === "") return prev;
        return [...prev, entry];
      });
    },
    [setFilters],
  );

  const removeFilter = useCallback(
    (columnId: string) => {
      setFilters((prev: FilterEntry[]) => prev.filter((f: FilterEntry) => f.columnId !== columnId));
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, [setFilters]);

  const hasActiveFilters = filters.length > 0;

  return useMemo(
    () => ({
      filters,
      setFilter,
      removeFilter,
      clearFilters,
      hasActiveFilters,
    }),
    [filters, setFilter, removeFilter, clearFilters, hasActiveFilters],
  );
}
