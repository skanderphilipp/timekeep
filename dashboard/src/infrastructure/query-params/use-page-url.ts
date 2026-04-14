import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { PageUrlOptions } from "./types";

/**
 * Sync the current page number to a URL search param.
 *
 * Stored as `{namespace}_page=<number>`.  Page is always ≥ 1.
 * Removed from URL when at the default (usually page 1).
 *
 * @example
 * ```ts
 * const { page, setPage, resetPage } = usePageUrl({ namespace: "punches" });
 * ```
 */
export function usePageUrl({
  namespace,
  defaultPage = 1,
}: PageUrlOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  const paramKey = `${namespace}_page`;

  // Decode page from URL
  const page: number = useMemo(() => {
    const raw = searchParams.get(paramKey);
    if (raw !== null) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed >= 1) {
        return parsed;
      }
    }
    return defaultPage;
  }, [searchParams, paramKey, defaultPage]);

  // Write page to URL
  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.round(next));
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          if (clamped === defaultPage) {
            nextParams.delete(paramKey);
          } else {
            nextParams.set(paramKey, String(clamped));
          }
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams, paramKey, defaultPage],
  );

  const resetPage = useCallback(() => setPage(defaultPage), [setPage, defaultPage]);

  return { page, setPage, resetPage } as const;
}
