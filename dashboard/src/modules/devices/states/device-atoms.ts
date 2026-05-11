import { atom } from "jotai";

/**
 * Device module state atoms.
 *
 * - `selectedDeviceSnAtom` — the serial number of the currently
 *   selected/focused device. Used by the side panel detail view
 *   and by any component that needs to know which device is active.
 */

/** Currently selected device serial number. `null` = no device selected. */
export const selectedDeviceSnAtom = atom<string | null>(null);
