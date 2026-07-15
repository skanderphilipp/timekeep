import { atom } from "jotai";

/**
 * Side panel sub-page entry — a step within a guided flow.
 *
 * Used by Pattern 2 (Guided Flow) for multi-step wizards inside the side panel.
 * Each step pushes onto a stack; the back button pops it off.
 *
 * Twenty reference:
 *   `twenty-front/src/modules/side-panel/hooks/useSidePanelSubPageHistory.ts`
 */
export type SubPageEntry = {
  /** UUID — used as React key for proper remount on step change. */
  id: string;
  /** Step identifier — used by the wizard to decide what to render. */
  step: string;
  /** Title shown in the back-button header (e.g., "Scan Results"). */
  title: string;
  /**
   * Arbitrary data passed between steps.
   * Step 1 passes scan results → Step 2 reads them.
   */
  params?: Record<string, unknown>;
};

// ── Sub-page stack atoms ──────────────────────────────────────────────────

/**
 * The full sub-page stack within a wizard. New steps push onto the end.
 * Cleared automatically when the parent side panel entry is closed.
 */
export const sidePanelSubPageStackAtom = atom<SubPageEntry[]>([]);

// Derived: the currently active sub-page (top of stack).
// Returns null when there are no sub-pages (i.e., the root form/detail is showing).
export const sidePanelCurrentSubPageAtom = atom<SubPageEntry | null>((get) => {
  const stack = get(sidePanelSubPageStackAtom);
  return stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;
});

// Derived: whether there's a previous step to go back to.
export const sidePanelCanGoBackSubPageAtom = atom<boolean>((get) => {
  return get(sidePanelSubPageStackAtom).length > 1;
});

// ── Navigation operations ─────────────────────────────────────────────────

/** Push a new sub-page onto the stack (advance to next step). */
export const pushSubPageAtom = atom(null, (_get, set, entry: SubPageEntry) => {
  set(sidePanelSubPageStackAtom, (prev) => [...prev, entry]);
});

/** Pop the current sub-page off the stack (go back one step). */
export const popSubPageAtom = atom(null, (_get, set) => {
  set(sidePanelSubPageStackAtom, (prev) => prev.slice(0, -1));
});

/** Clear all sub-pages (close the wizard, return to root). */
export const clearSubPagesAtom = atom(null, (_get, set) => {
  set(sidePanelSubPageStackAtom, []);
});
