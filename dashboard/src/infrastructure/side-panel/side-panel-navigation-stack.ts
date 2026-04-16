import { atom } from "jotai";
import type { EntityType } from "@/modules/data-renderer/types";

/**
 * Side panel navigation entry.
 *
 * Each entry represents a "page" in the side panel's navigation stack.
 * The stack enables back-button support: push a new entity detail
 * without losing the previous one.
 */
export type SidePanelEntry = {
  /** UUID — scopes Jotai atoms for this panel instance. */
  instanceId: string;
  /** The type of entity being displayed. */
  entityType: EntityType;
  /** The entity's unique identifier. */
  entityId: string;
  /** Title shown in the side panel header. */
  title: string;
};

// ── Navigation stack atoms ──────────────────────────────────────────────

/**
 * The full navigation stack. New entries are pushed on the end.
 */
export const sidePanelStackAtom = atom<SidePanelEntry[]>([]);

/**
 * Index of the currently active entry. Always the last entry
 * for a simple push/pop model (no browser-style "forward").
 */
export const sidePanelActiveIndexAtom = atom<number>(0);

// Derived: the currently active entry
export const sidePanelActiveEntryAtom = atom<SidePanelEntry | null>((get) => {
  const stack = get(sidePanelStackAtom);
  const index = get(sidePanelActiveIndexAtom);
  if (stack.length === 0) return null;
  return stack[index] ?? stack[stack.length - 1] ?? null;
});

// ── Navigation operations ───────────────────────────────────────────────

/** Push a new entry onto the stack and navigate to it. */
export const pushSidePanelAtom = atom(
  null,
  (get, set, entry: SidePanelEntry) => {
    const stack = get(sidePanelStackAtom);
    const next = [...stack, entry];
    set(sidePanelStackAtom, next);
    set(sidePanelActiveIndexAtom, next.length - 1);
  },
);

/** Pop the top entry off the stack (go back). */
export const popSidePanelAtom = atom(null, (get, set) => {
  const stack = get(sidePanelStackAtom);
  if (stack.length <= 1) {
    set(sidePanelStackAtom, []);
    set(sidePanelActiveIndexAtom, 0);
    return;
  }
  const next = stack.slice(0, -1);
  set(sidePanelStackAtom, next);
  set(sidePanelActiveIndexAtom, next.length - 1);
});

/** Clear the entire stack and close the panel. */
export const clearSidePanelStackAtom = atom(null, (_get, set) => {
  set(sidePanelStackAtom, []);
  set(sidePanelActiveIndexAtom, 0);
});
