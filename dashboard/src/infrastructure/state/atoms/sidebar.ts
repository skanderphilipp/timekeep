import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Sidebar state atoms.
 *
 * `sidebarOpenAtom` — transient overlay state (mobile). Not persisted;
 *   resets to closed on every page load.
 * `sidebarCollapsedAtom` — persisted desktop collapsed state. Survives
 *   full page refreshes so the user's preference is remembered.
 */

/** Mobile sidebar overlay. Transient — always starts closed on page load. */
export const sidebarOpenAtom = atom(false);

/** Desktop sidebar collapsed state. Persisted across sessions. */
export const sidebarCollapsedAtom = atomWithStorage(
  "ao:sidebar-collapsed",
  false,
);
