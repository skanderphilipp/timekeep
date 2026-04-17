import { atom } from "jotai";

/**
 * Generic filter state atom factory.
 *
 * Creates a trio of atoms for managing filter state in list pages:
 * - `filterAtom` — readable/writable atom holding the current filter values.
 * - `updateFilterAtom` — write-only atom to merge partial updates.
 * - `resetFilterAtom` — write-only atom to reset to initial values.
 *
 * @example
 * ```ts
 * const { filterAtom, updateFilterAtom, resetFilterAtom } =
 *   createFilterAtoms({ search: "", status: "all" });
 *
 * // In component:
 * const filter = useAtomValue(filterAtom);
 * const updateFilter = useSetAtom(updateFilterAtom);
 * updateFilter({ search: "john" }); // merges into existing filter
 * ```
 */

export type FilterAtoms<T extends Record<string, unknown>> = {
  /** Current filter values. Read/write. */
  filterAtom: ReturnType<typeof atom<T>>;
  /** Merges partial updates into the current filter. Write-only. */
  updateFilterAtom: ReturnType<typeof atom<unknown, [Partial<T>], void>>;
  /** Resets the filter to the initial values. Write-only. */
  resetFilterAtom: ReturnType<typeof atom<unknown, [], void>>;
};

export function createFilterAtoms<T extends Record<string, unknown>>(
  initial: T,
): FilterAtoms<T> {
  const filterAtom = atom<T>(initial);

  const updateFilterAtom = atom(null, (_get, set, update: Partial<T>) => {
    set(filterAtom, { ..._get(filterAtom), ...update });
  });

  const resetFilterAtom = atom(null, (_get, set) => {
    set(filterAtom, initial);
  });

  return { filterAtom, updateFilterAtom, resetFilterAtom };
}
