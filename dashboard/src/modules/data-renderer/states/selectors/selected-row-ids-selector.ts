import { atom } from "jotai";
import { tableRowSelectionFamilyState } from "../atoms/row-selection-state";

/**
 * Returns an atom that resolves to the array of currently selected row IDs.
 *
 * Usage:
 * ```ts
 * const selectedIdsAtom = selectedRowIdsSelector(instanceId);
 * const selectedIds = useAtomValue(selectedIdsAtom);
 * ```
 */
export function selectedRowIdsSelector(instanceId: string) {
  return atom((get) => {
    const selection = get(tableRowSelectionFamilyState(instanceId));
    return Array.from(selection.selectedIds.keys());
  });
}
