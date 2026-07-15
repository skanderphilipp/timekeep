import { atom } from "jotai";
import { createFamilyState } from "@/infrastructure/state/jotai";
import type { RowSelectionState } from "../../types";

/**
 * Per-table-instance row selection state.
 *
 * Call `tableRowSelectionFamilyState.remove(instanceId)` on unmount.
 */
export const tableRowSelectionFamilyState = createFamilyState<
  RowSelectionState,
  string
>({
  key: "tableRowSelection",
  defaultValue: {
    selectedIds: new Map<string, boolean>(),
  },
});

/** Toggle a single row's selection for a given table instance. */
export const toggleRowSelectionAtom = atom(
  null,
  (get, set, payload: { instanceId: string; rowId: string }) => {
    const selectionAtom = tableRowSelectionFamilyState(payload.instanceId);
    const prev = get(selectionAtom);
    const next = new Map(prev.selectedIds);
    if (next.has(payload.rowId)) {
      next.delete(payload.rowId);
    } else {
      next.set(payload.rowId, true);
    }
    set(selectionAtom, { selectedIds: next });
  },
);

/** Select all rows for a given table instance. */
export const selectAllRowsAtom = atom(
  null,
  (_get, set, payload: { instanceId: string; rowIds: string[] }) => {
    const selectionAtom = tableRowSelectionFamilyState(payload.instanceId);
    const next = new Map<string, boolean>();
    for (const id of payload.rowIds) {
      next.set(id, true);
    }
    set(selectionAtom, { selectedIds: next });
  },
);

/** Clear all row selections for a given table instance. */
export const deselectAllRowsAtom = atom(null, (_get, set, payload: { instanceId: string }) => {
  const selectionAtom = tableRowSelectionFamilyState(payload.instanceId);
  set(selectionAtom, { selectedIds: new Map() });
});
