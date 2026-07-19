import { createFamilyState } from "@/infrastructure/state/jotai";
import type { FilterEntry } from "../../types";

/**
 * @internal — Per-table-instance column-header filter state (Jotai atomFamily).
 *
 * Scoped to individual {@link DataTableContainer} instances via `instanceId`.
 * NOT for page-level filters — see {@link useListState} for URL-synced page filters.
 *
 * Each table instance gets its own filter array atom.
 * Call `tableFilterFamilyState.remove(instanceId)` on unmount
 * to prevent memory leaks.
 */
export const tableFilterFamilyState = createFamilyState<FilterEntry[], string>({
  key: "tableFilter",
  defaultValue: [],
});
