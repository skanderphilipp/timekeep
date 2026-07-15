import { createFamilyState } from "@/infrastructure/state/jotai";

/**
 * Per-table-instance loading state.
 *
 * Tracks whether a table instance is currently loading data.
 * Call `tableLoadingFamilyState.remove(instanceId)` on unmount.
 */
export const tableLoadingFamilyState = createFamilyState<boolean, string>({
  key: "tableLoading",
  defaultValue: false,
});
