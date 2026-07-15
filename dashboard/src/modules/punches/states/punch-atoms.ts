import { createState } from "@/infrastructure/state/jotai";
import type { PunchStatusValue } from "@shared/punch-statuses";

/**
 * Punch module state atoms.
 */

/** Currently selected punch record ID. `null` = no punch selected. */
export const selectedPunchIdState = createState<string | null>({
  key: "selectedPunchId",
  defaultValue: null,
});

/** Current search term for filtering punches. */
export const punchSearchState = createState<string>({
  key: "punchSearch",
  defaultValue: "",
});

/** Active status filter for punch records. */
export const punchStatusFilterState = createState<PunchStatusValue | null>({
  key: "punchStatusFilter",
  defaultValue: null,
});

/** Active device filter (by serial number). */
export const punchDeviceFilterState = createState<string | null>({
  key: "punchDeviceFilter",
  defaultValue: null,
});
