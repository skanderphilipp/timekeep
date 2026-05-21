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

import { LS_AUTH, LS_THEME, LS_LOCALE } from "@/lib/constants";

/** All localStorage keys managed by Jotai atoms that should be cleared between tests. */
const JOTAI_STORAGE_KEYS = [LS_AUTH, LS_THEME, LS_LOCALE];

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
