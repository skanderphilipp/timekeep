import { atom } from "jotai";
import { tableRowSelectionFamilyState } from "../atoms/row-selection-state";

/**
 * Returns an atom that resolves to `true` when all provided row IDs
 * are selected for the given table instance.
 */
export function allRowsSelectedSelector(instanceId: string, totalRowIds: string[]) {
  return atom((get) => {
    const selection = get(tableRowSelectionFamilyState(instanceId));
    if (totalRowIds.length === 0) return false;
    return totalRowIds.every((id) => selection.selectedIds.has(id));
  });
}
