import { atom } from "jotai";

/**
 * Punch module state atoms.
 *
 * - `selectedPunchIdAtom` — the ID of the currently selected punch.
 */

/** Currently selected punch record ID. `null` = no punch selected. */
export const selectedPunchIdAtom = atom<string | null>(null);
