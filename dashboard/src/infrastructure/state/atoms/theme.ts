import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { LS_THEME } from "@/lib/constants";

/**
 * Theme state management via Jotai atoms.
 *
 * - `themeAtom` — persisted theme value ("light" | "dark"). Source of truth.
 * - `toggleThemeAtom` — write-only convenience atom for toggling.
 *
 * DOM synchronization (class toggling on <html>) happens in the AppShell
 * via a useEffect that watches `themeAtom`. Initial FOUC prevention happens
 * in main.tsx before React renders.
 */

export type Theme = "light" | "dark";

/** Persisted theme atom. Synced to localStorage via atomWithStorage. */
export const themeAtom = atomWithStorage<Theme>(LS_THEME, "light");

/** Write-only atom that toggles between light ↔ dark. */
export const toggleThemeAtom = atom(null, (_get, set) => {
  set(themeAtom, (prev) => (prev === "dark" ? "light" : "dark"));
});
