import type { WritableAtom } from "jotai";

/**
 * Simple atom family — a parameterized atom factory with caching.
 *
 * Replaces the deprecated `atomFamily` from `jotai/utils`.
 * Keeps a `Map` of created atoms keyed by parameter.
 *
 * Returns writable atoms so `get()` / `set()` work in derived write atoms.
 */
export function makeAtomFamily<Param, Value, Update>(
  initialize: (param: Param) => WritableAtom<Value, [Update], void>,
): (param: Param) => WritableAtom<Value, [Update], void> {
  const cache = new Map<Param, WritableAtom<Value, [Update], void>>();

  return (param: Param): WritableAtom<Value, [Update], void> => {
    const existing = cache.get(param);
    if (existing) return existing;

    const newAtom = initialize(param);
    cache.set(param, newAtom);
    return newAtom;
  };
}
