import { atom } from "jotai";
import { createState } from "@/infrastructure/state/jotai";
import { STORAGE_KEYS } from "@/lib/constants";

/**
 * Sidebar state atoms.
 *
 * `sidebarOpenAtom` — transient overlay state (mobile). Not persisted;
 *   resets to closed on every page load.
 * `sidebarCollapsedState` — persisted desktop collapsed state. Survives
 *   full page refreshes so the user's preference is remembered.
 */

/** Mobile sidebar overlay. Transient — always starts closed on page load. */
export const sidebarOpenAtom = atom(false);

/** Desktop sidebar collapsed state. Persisted across sessions. */
export const sidebarCollapsedState = createState<boolean>({
  key: STORAGE_KEYS.sidebarCollapsed,
  defaultValue: false,
  localStorage: true,
});


