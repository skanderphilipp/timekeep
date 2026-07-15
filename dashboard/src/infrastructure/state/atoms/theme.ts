import { atom } from "jotai";
import { createState } from "@/infrastructure/state/jotai";
import { STORAGE_KEYS } from "@/lib/constants";

/**
 * Theme state management via Jotai atoms.
 *
 * - `themeState` — persisted theme value ("light" | "dark"). Source of truth.
 * - `toggleThemeAtom` — write-only convenience atom for toggling.
 *
 * DOM synchronization (class toggling on <html>) happens in the AppShell
 * via a useEffect that watches `themeState`. Initial FOUC prevention happens
 * in main.tsx before React renders.
 */

export type Theme = "light" | "dark";

/** Persisted theme state. Synced to localStorage via the Jotai state layer. */
export const themeState = createState<Theme>({
  key: STORAGE_KEYS.theme,
  defaultValue: "light",
  localStorage: true,
});

/** Write-only atom that toggles between light ↔ dark. */
export const toggleThemeAtom = atom(null, (_get, set) => {
  set(themeState.atom, (prev) => (prev === "dark" ? "light" : "dark"));
});


