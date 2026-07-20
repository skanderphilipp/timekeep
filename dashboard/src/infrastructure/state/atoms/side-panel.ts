import { atom } from "jotai";
import { createState } from "@/infrastructure/state/jotai";
import { STORAGE_KEYS } from "@/lib/constants";

// ── Constants ────────────────────────────────────────────────────────────

/** Side panel constraints. Ported from SIDE_PANEL_CONSTRAINTS. */
export const SIDE_PANEL_CONSTRAINTS = {
  min: 320,
  max: 600,
  default: 400,
} as const;

/** CSS custom property name for the side panel width. */
export const SIDE_PANEL_WIDTH_VAR = "--tk-side-panel-width";

/**
 * Side panel state management via Jotai atoms.
 *
 * - `sidePanelOpenAtom` — whether the panel is visible.
 * - `sidePanelTitleAtom` — panel header title.
 * - `sidePanelContentAtom` — the component/content to render inside the panel.
 *   When set to `null`, the panel is effectively empty (should be closed).
 *
 * Usage pattern:
 *   1. Set title + content atoms
 *   2. Set openAtom to true
 *   3. On close, set openAtom to false (content/title can be cleared or kept)
 */

/** Whether the right side panel is open. */
export const sidePanelOpenAtom = atom(false);

/** Panel header title. */
export const sidePanelTitleAtom = atom<string | undefined>(undefined);

/**
 * Internal: stores render functions wrapped in an object.
 *
 * Jotai's simple writable atoms interpret function values as updaters
 * (same as React's setState(prev => newValue)). To store a render
 * function without Jotai calling it, we wrap it in `{ fn }`.
 */
type ContentWrapper = { fn: () => React.ReactNode };
const rawContentAtom = atom<ContentWrapper | null>(null);

/**
 * Panel content renderer — safely stores a render function in Jotai.
 *
 * Read: returns the stored function or null.
 * Write: wraps the function in an object so Jotai doesn't call it as
 * an updater. Set to `null` when the panel has no content to render.
 */
export const sidePanelContentAtom = atom(
  (get): (() => React.ReactNode) | null => {
    const wrapper = get(rawContentAtom);
    return wrapper?.fn ?? null;
  },
  (_get, set, fn: (() => React.ReactNode) | null) => {
    set(rawContentAtom, fn ? { fn } : null);
  },
);

/**
 * Convenience write-only atom: opens the panel with given title and content.
 *
 * @example
 * ```tsx
 * const openSidePanel = useSetAtom(openSidePanelAtom);
 * openSidePanel({ title: "Device Details", render: () => <DeviceDetail id={sn} /> });
 * ```
 */
export const openSidePanelAtom = atom(
  null,
  (_get, set, payload: { title?: string; render: () => React.ReactNode }) => {
    set(sidePanelTitleAtom, payload.title);
    set(sidePanelContentAtom, payload.render);
    set(sidePanelOpenAtom, true);
  },
);

/** Convenience write-only atom: closes the panel. */
export const closeSidePanelAtom = atom(null, (_get, set) => {
  set(sidePanelOpenAtom, false);
});

/**
 * Side panel width in pixels.
 *
 * Persisted to localStorage so the user's preferred panel width survives
 * page refreshes. The CSS variable `--tk-side-panel-width` is set by the
 * SidePanel component on mount and during resize.
 */
export const sidePanelWidthState = createState<number>({
  key: STORAGE_KEYS.sidePanelWidth,
  defaultValue: SIDE_PANEL_CONSTRAINTS.default,
  localStorage: true,
});
