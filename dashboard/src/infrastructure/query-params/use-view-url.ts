import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ViewUrlOptions } from "./types";

/**
 * Sync a view ID to URL search params.
 *
 * Stored as `{namespace}_view` in the URL.
 * When a viewId is present, it identifies a server-side view configuration
 * (e.g., a named filter set persisted in the backend).
 *
 * Future: when `viewId` is set AND a server-side view is loaded, individual
 * filter/sort/page params from the URL may be superseded by the view.
 *
 * Currently the viewId operates independently — filter/sort/pagination still
 * read from their own URL params regardless of whether a viewId is set.
 *
 * @example
 * ```ts
 * const { viewId, setViewId } = useViewUrl({ namespace: "punches" });
 * setViewId("view-abc-123");  // → URL: ?punches_view=view-abc-123
 * setViewId(undefined);        // → URL: param removed
 * ```
 */
export function useViewUrl({ namespace }: ViewUrlOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramKey = `${namespace}_view`;

  const viewId = useMemo(
    () => searchParams.get(paramKey) ?? undefined,
    [searchParams, paramKey],
  );

  const setViewId = useCallback(
    (id: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) {
            next.set(paramKey, id);
          } else {
            next.delete(paramKey);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, paramKey],
  );

  return { viewId, setViewId } as const;
}
