import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPunchesCursor, type Punch, type PunchFilter } from "@/lib/api";
import { CURSOR_PAGE_SIZE, PUNCHES_STALE_TIME_MS } from "@/lib/constants";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Infinite punch data hook for cursor-based pagination.
 *
 * Uses TanStack Query's `useInfiniteQuery` with `fetchPunchesCursor`
 * which returns `{ punches, has_more, next_cursor }`.
 *
 * Each page fetches `CURSOR_PAGE_SIZE` (20) punches. The cursor
 * from the previous page's response drives the next page request.
 */
export function useInfinitePunchData(filter: Omit<PunchFilter, "limit" | "offset" | "cursor">) {
  return useInfiniteQuery({
    queryKey: QueryKeys.punches.infinite(filter),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      return fetchPunchesCursor({
        ...filter,
        limit: CURSOR_PAGE_SIZE,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.has_more) return undefined;
      return lastPage.next_cursor ?? undefined;
    },
    staleTime: PUNCHES_STALE_TIME_MS,
  });
}

export type { Punch, PunchFilter };
