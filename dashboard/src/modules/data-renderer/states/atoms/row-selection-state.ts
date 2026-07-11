import { atom } from "jotai";
import { makeAtomFamily } from "./atom-family";
import type { RowSelectionState } from "../../types";

export const tableRowSelectionStateFamily = makeAtomFamily((_instanceId: string) =>
  atom<RowSelectionState>({
    selectedIds: new Map<string, boolean>(),
  }),
);

export const toggleRowSelectionAtom = atom(
  null,
  (get, set, payload: { instanceId: string; rowId: string }) => {
    const selectionAtom = tableRowSelectionStateFamily(payload.instanceId);
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

export const selectAllRowsAtom = atom(
  null,
  (_get, set, payload: { instanceId: string; rowIds: string[] }) => {
    const selectionAtom = tableRowSelectionStateFamily(payload.instanceId);
    const next = new Map<string, boolean>();
    for (const id of payload.rowIds) {
      next.set(id, true);
    }
    set(selectionAtom, { selectedIds: next });
  },
);

export const deselectAllRowsAtom = atom(null, (_get, set, payload: { instanceId: string }) => {
  const selectionAtom = tableRowSelectionStateFamily(payload.instanceId);
  set(selectionAtom, { selectedIds: new Map() });
});
