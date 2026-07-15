import type { Getter } from "jotai";
import type { FamilySelector, FamilyState, Selector, SelectorGetter, State } from "../types";

/**
 * Builds a typed `get` helper for selector functions.
 *
 * Wraps Jotai's raw `Getter` so selectors can use a type-safe API:
 *
 * ```ts
 * const getHelper = buildGetHelper(jotaiGet);
 * getHelper(myState);              // returns ValueType
 * getHelper(myFamily, familyKey);  // returns ValueType
 * ```
 *
 * @param jotaiGet - Jotai's raw `Getter` from `atom((get) => ...)`
 */
export function buildGetHelper(jotaiGet: Getter): SelectorGetter {
  function getter<T>(state: State<T> | Selector<T>): T;
  function getter<T, K>(
    family: FamilyState<T, K> | FamilySelector<T, K>,
    familyKey: K,
  ): T;
  function getter<T, K>(
    stateOrFamily:
      | State<T>
      | Selector<T>
      | FamilyState<T, K>
      | FamilySelector<T, K>,
    familyKey?: K,
  ): T {
    // Family access: get(familyState, familyKey)
    if (familyKey !== undefined) {
      const family = stateOrFamily as
        | FamilyState<T, K>
        | FamilySelector<T, K>;
      return jotaiGet(family.atomFamily(familyKey));
    }

    // Direct access: get(state) or get(selector)
    const state = stateOrFamily as State<T> | Selector<T>;
    return jotaiGet(state.atom);
  }

  return getter as SelectorGetter;
}
