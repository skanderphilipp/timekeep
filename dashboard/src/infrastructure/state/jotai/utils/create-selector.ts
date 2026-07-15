import { atom } from "jotai";
import { selectAtom } from "jotai/utils";
import type { Selector, SelectorGetter } from "../types";
import { buildGetHelper } from "./build-get-helper";

/**
 * Creates a typed, keyed, debuggable Jotai selector (read-only derived atom).
 *
 * Selectors derive their value from other states/selectors and recalculate
 * automatically when dependencies change.
 *
 * @example
 * ```ts
 * export const isAuthenticatedSelector = createSelector({
 *   key: "isAuthenticated",
 *   get: ({ get }) => get(authTokenState) !== null,
 * });
 * ```
 */
export function createSelector<ValueType>({
  key,
  get,
  areEqual,
}: {
  key: string;
  get: (helpers: { get: SelectorGetter }) => ValueType;
  /** Optional equality function to suppress re-renders. */
  areEqual?: (previous: ValueType, next: ValueType) => boolean;
}): Selector<ValueType> {
  const derivedAtom = atom((jotaiGet) => {
    const getHelper = buildGetHelper(jotaiGet);
    return get({ get: getHelper });
  });

  const finalAtom = areEqual
    ? selectAtom(derivedAtom, (value) => value, areEqual)
    : derivedAtom;

  finalAtom.debugLabel = key;

  return {
    type: "Selector" as const,
    key,
    atom: finalAtom,
  };
}
