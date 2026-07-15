import { createFamilyState } from "@/infrastructure/state/jotai";
import type { FilterEntry } from "../../types";

/**
 * Per-table-instance filter state.
 *
 * Each table instance gets its own filter array atom.
 * Call `tableFilterFamilyState.remove(instanceId)` on unmount
 * to prevent memory leaks.
 */
export const tableFilterFamilyState = createFamilyState<FilterEntry[], string>({
  key: "tableFilter",
  defaultValue: [],
});
