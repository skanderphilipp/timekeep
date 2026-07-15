import { atom, type WritableAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { FamilyState } from "../types";

type StateAtom<ValueType> = WritableAtom<
  ValueType,
  [ValueType | ((prev: ValueType) => ValueType)],
  void
>;

/**
 * Creates a typed, keyed, debuggable Jotai atom family.
 *
 * Atom families create atoms on-demand keyed by a parameter value.
 * Each created atom has a `debugLabel` of `{key}__{familyKey}`.
 *
 * **Memory management:** The returned family includes a `remove()` method.
 * Call `remove(familyKey)` when the component using that instance unmounts
 * to prevent unbounded cache growth.
 *
 * @example
 * ```ts
 * const tableSortFamilyState = createFamilyState<string[], string>({
 *   key: "tableSort",
 *   defaultValue: [],
 * });
 *
 * // In component:
 * const sortAtom = tableSortFamilyState(instanceId);
 *
 * // In cleanup:
 * useEffect(() => {
 *   return () => tableSortFamilyState.remove(instanceId);
 * }, [instanceId]);
 * ```
 */
export function createFamilyState<ValueType, FamilyKey>({
  key,
  defaultValue,
}: {
  key: string;
  defaultValue: ValueType;
}): FamilyState<ValueType, FamilyKey> & {
  /** Remove a cached atom instance to prevent memory leaks. Call on unmount. */
  remove: (familyKey: FamilyKey) => void;
  /** Number of cached instances. Useful for debugging/monitoring. */
  readonly size: number;
} {
  const atomCache = new Map<string, StateAtom<ValueType>>();

  const familyFunction = (
    familyKey: FamilyKey,
  ): StateAtom<ValueType> => {
    const cacheKey =
      typeof familyKey === "string" ? familyKey : JSON.stringify(familyKey);

    const existing = atomCache.get(cacheKey);
    if (existing) return existing;

    const atomKey = `${key}__${cacheKey}`;
    const baseAtom = atom(defaultValue);
    baseAtom.debugLabel = atomKey;
    atomCache.set(cacheKey, baseAtom);

    return baseAtom;
  };

  const remove = (familyKey: FamilyKey) => {
    const cacheKey =
      typeof familyKey === "string" ? familyKey : JSON.stringify(familyKey);
    atomCache.delete(cacheKey);
  };

  return Object.assign(familyFunction, {
    type: "FamilyState" as const,
    key,
    atomFamily: familyFunction,
    remove,
    get size() {
      return atomCache.size;
    },
  });
}

/**
 * Creates a typed, keyed, debuggable Jotai atom family with localStorage persistence.
 *
 * Like {@link createFamilyState} but each family member is persisted
 * to localStorage using `atomWithStorage`.
 *
 * @example
 * ```ts
 * const entitySchemaFamilyState = createPersistentFamilyState<EntitySchema, string>({
 *   key: "entitySchema",
 *   defaultValue: null,
 * });
 * ```
 */
export function createPersistentFamilyState<ValueType, FamilyKey>({
  key,
  defaultValue,
}: {
  key: string;
  defaultValue: ValueType;
}): FamilyState<ValueType, FamilyKey> & {
  remove: (familyKey: FamilyKey) => void;
  readonly size: number;
} {
  const atomCache = new Map<string, StateAtom<ValueType>>();

  const familyFunction = (
    familyKey: FamilyKey,
  ): StateAtom<ValueType> => {
    const cacheKey =
      typeof familyKey === "string" ? familyKey : JSON.stringify(familyKey);

    const existing = atomCache.get(cacheKey);
    if (existing) return existing;

    const atomKey = `${key}__${cacheKey}`;
    const baseAtom = atomWithStorage<ValueType>(
      atomKey,
      defaultValue,
      undefined,
      { getOnInit: true },
    ) as StateAtom<ValueType>;
    baseAtom.debugLabel = atomKey;
    atomCache.set(cacheKey, baseAtom);

    return baseAtom;
  };

  const remove = (familyKey: FamilyKey) => {
    const cacheKey =
      typeof familyKey === "string" ? familyKey : JSON.stringify(familyKey);
    atomCache.delete(cacheKey);
  };

  return Object.assign(familyFunction, {
    type: "FamilyState" as const,
    key,
    atomFamily: familyFunction,
    remove,
    get size() {
      return atomCache.size;
    },
  });
}
