import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortField, SortUrlOptions } from "./types";

/**
 * Sync sort state (column + direction) to URL search params.
 *
 * Stored as `{namespace}_sort=<column>` and `{namespace}_order=asc|desc`.
 * When sort is cleared, both params are removed.
 *
 * The `toggleSort` helper cycles:  none → asc → desc → none.
 *
 * @example
 * ```ts
 * const { sort, toggleSort } = useSortUrl({ namespace: "punches" });
 *
 * toggleSort("timestamp");  // asc
 * toggleSort("timestamp");  // desc
 * toggleSort("timestamp");  // none (params removed)
 * ```
 */
export function useSortUrl({ namespace, defaultSort = null }: SortUrlOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  const sortParam = `${namespace}_sort`;
  const orderParam = `${namespace}_order`;

  // Decode sort from URL
  const sort: SortField | null = useMemo(() => {
    const column = searchParams.get(sortParam);
    const dir = searchParams.get(orderParam);
    if (column && (dir === "asc" || dir === "desc")) {
      return { column, direction: dir };
    }
    return defaultSort;
  }, [searchParams, sortParam, orderParam, defaultSort]);

  // Write sort to URL
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
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams, sortParam, orderParam],
  );

  // Toggle: none → asc → desc → none
  const toggleSort = useCallback(
    (column: string) => {
      if (!sort || sort.column !== column) {
        setSort({ column, direction: "asc" });
      } else if (sort.direction === "asc") {
        setSort({ column, direction: "desc" });
      } else {
        setSort(null);
      }
    },
    [sort, setSort],
  );

  return { sort, setSort, toggleSort } as const;
}
