import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { FilterValues, FilterUrlOptions } from "./types";

/**
 * Sync a flat filter object to URL search params.
 *
 * Each filter field is stored as `{namespace}_{fieldName}` in the URL.
 * Fields matching their default value are omitted from the URL.
 * Changes use `replace` (no history push) to avoid polluting the back stack
 * during rapid filter interactions.
 *
 * @example
 * ```ts
 * const { filters, setFilter, resetFilters, hasActiveFilters } = useFilterUrl({
 *   namespace: "punches",
 *   defaults: { device_sn: "", user_pin: "", since: "", until: "" },
 * });
 *
 * setFilter({ user_pin: "42" });  // → URL: ?punches_user_pin=42
 * setFilter({ user_pin: "" });    // → URL: param removed
 * ```
 */
export function useFilterUrl<T extends FilterValues>({ namespace, defaults }: FilterUrlOptions<T>) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Decode current filter values from URL → state
  const filters = useMemo(() => {
    const result = { ...defaults } as T;
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const paramKey = `${namespace}_${String(key)}`;
      const raw = searchParams.get(paramKey);
      if (raw !== null) {
        (result as Record<string, string | undefined>)[key as string] = raw;
      }
    }
    return result;
  }, [searchParams, namespace, defaults]);

  // Whether any filter differs from its default
  const hasActiveFilters = useMemo(
    () => (Object.keys(defaults) as (keyof T)[]).some((key) => filters[key] !== defaults[key]),
    [filters, defaults],
  );

  // Merge partial updates into URL
  const setFilter = useCallback(
    (update: Partial<T>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(update) as [string, string | undefined][]) {
            const paramKey = `${namespace}_${key}`;
            const defaultVal = (defaults as Record<string, string | undefined>)[key];
            if (value === undefined || value === "" || value === defaultVal) {
              next.delete(paramKey);
            } else {
              next.set(paramKey, value);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, namespace, defaults],
  );

  // Reset all filters to their defaults (removes all filter params from URL)
  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) {
          next.delete(`${namespace}_${key}`);
        }
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, namespace, defaults]);

  return { filters, setFilter, resetFilters, hasActiveFilters } as const;
}
