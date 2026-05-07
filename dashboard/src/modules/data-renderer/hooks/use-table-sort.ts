import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";

import { tableSortStateFamily } from "../states/atoms/sort-state";
import type { SortDirection, SortEntry } from "../types";

/**
 * Hook: table sort state + handlers for a given table instance.
 */
export function useTableSort(instanceId: string) {
  const sorts = useAtomValue(tableSortStateFamily(instanceId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setSorts = useSetAtom(tableSortStateFamily(instanceId) as any);

  const toggleSort = useCallback(
    (columnId: string) => {
      setSorts((prev: SortEntry[]) => {
        const existing = prev.find((s) => s.columnId === columnId);

        if (!existing) {
          return [{ columnId, direction: "asc" as SortDirection }];
        }

        if (existing.direction === "asc") {
          return [{ columnId, direction: "desc" as SortDirection }];
        }

        return prev.filter((s) => s.columnId !== columnId);
      });
    },
    [setSorts],
  );

  const setSort = useCallback(
    (columnId: string, direction: SortDirection) => {
      setSorts([{ columnId, direction }]);
    },
    [setSorts],
  );

  const clearSort = useCallback(() => {
    setSorts([]);
  }, [setSorts]);

  return useMemo(
    () => ({ sorts, toggleSort, setSort, clearSort }),
    [sorts, toggleSort, setSort, clearSort],
  );
}
