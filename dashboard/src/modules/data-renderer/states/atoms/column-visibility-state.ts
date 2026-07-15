import { createFamilyState } from "@/infrastructure/state/jotai";

/**
 * Per-table-instance column visibility state.
 *
 * Map of column ID → visible boolean. Columns not in the map are visible by default.
 * Call `tableColumnVisibilityFamilyState.remove(instanceId)` on unmount.
 */
export const tableColumnVisibilityFamilyState = createFamilyState<
  Map<string, boolean>,
  string
>({
  key: "tableColumnVisibility",
  defaultValue: new Map(),
});
