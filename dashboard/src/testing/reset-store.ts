/**
 * Jotai store reset utility for test isolation.
 *
 * Jotai's `atomWithStorage` persists to localStorage, which survives across tests
 * in the vitest in-memory localStorage polyfill. Call `resetJotaiStore()` in
 * `beforeEach` to ensure no state leaks between tests.
 *
 * Usage:
 *   import { resetJotaiStore } from "@/testing/reset-store";
 *   beforeEach(resetJotaiStore);
 */

import { ALL_STORAGE_KEYS } from "@/lib/constants";

/** All localStorage keys managed by Jotai atoms.
 * Derived from {@link STORAGE_KEYS} in `@/lib/constants` — the single source of truth. */
const JOTAI_STORAGE_KEYS = ALL_STORAGE_KEYS;

/**
 * Clears all localStorage keys used by Jotai `atomWithStorage` atoms.
 *
 * Call this in `beforeEach` for complete test isolation:
 *
 * ```
 * beforeEach(() => {
 *   resetJotaiStore();
 * });
 * ```
 */
export function resetJotaiStore(): void {
  for (const key of JOTAI_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

/**
 * Convenience: clears all localStorage (broader than just Jotai keys).
 * Use when test isolation requires a completely clean slate.
 */
export function resetAllStorage(): void {
  localStorage.clear();
}
