import { createFamilyState } from "@/infrastructure/state/jotai";
import type { SortEntry } from "../../types";

/**
 * Per-table-instance sort state.
 *
 * Each table instance gets its own sort array atom.
 * Call `tableSortFamilyState.remove(instanceId)` on unmount.
 */
export const tableSortFamilyState = createFamilyState<SortEntry[], string>({
  key: "tableSort",
  defaultValue: [],
});
