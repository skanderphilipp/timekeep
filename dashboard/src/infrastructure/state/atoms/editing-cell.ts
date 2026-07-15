import { atom, useAtomValue, useSetAtom } from "jotai";

/**
 * Inline Editing — Focus System (Phase 3)
 *
 * Tracks which table cell is currently being edited. Only one cell
 * can be in edit mode at a time (simpler than Twenty's focus stack).
 *
 * - `editingCellIdAtom` — the raw Jotai atom (transient, not persisted)
 * - `useIsEditingCell(cellId)` — read-only selector
 * - `useEnterEditMode()` — returns a setter function
 * - `useExitEditMode()` — returns a conditional clearer
 *
 * Cell IDs follow the convention `{rowId}:{columnId}` so that
 * cell identity is stable across re-renders and does not depend
 * on component instances.
 */

/** The cell currently in edit mode, or null when no cell is being edited. */
export const editingCellIdAtom = atom<string | null>(null);

// ── Cell ID helpers ──────────────────────────────────────────────────

/** Parses a cell ID into its row and column components. */
function parseCellId(cellId: string): { rowId: string; columnId: string } {
  const lastColon = cellId.lastIndexOf(":");
  if (lastColon === -1) return { rowId: cellId, columnId: "" };
  return {
    rowId: cellId.substring(0, lastColon),
    columnId: cellId.substring(lastColon + 1),
  };
}

/** Builds a cell ID from a row ID and column ID. */
export function buildCellId(rowId: string, columnId: string): string {
  return `${rowId}:${columnId}`;
}

/**
 * Returns whether the given cell is currently being edited.
 *
 * @example
 * const isEditing = useIsEditingCell(`${rowId}:${columnId}`);
 */
export function useIsEditingCell(cellId: string): boolean {
  return useAtomValue(editingCellIdAtom) === cellId;
}

/**
 * Returns a function that enters edit mode for a cell.
 *
 * @example
 * const enterEdit = useEnterEditMode();
 * enterEdit(`${rowId}:${columnId}`);
 */
export function useEnterEditMode() {
  const set = useSetAtom(editingCellIdAtom);
  return (cellId: string) => set(cellId);
}

/**
 * Returns a function that exits edit mode for a cell.
 *
 * Only clears the atom when the exiting cell matches the currently
 * edited cell — prevents a stale exit callback from closing a different
 * cell that was opened in the meantime.
 *
 * @example
 * const exitEdit = useExitEditMode();
 * exitEdit(`${rowId}:${columnId}`);
 */
export function useExitEditMode() {
  const set = useSetAtom(editingCellIdAtom);
  return (cellId: string) => {
    set((prev) => (prev === cellId ? null : prev));
  };
}

// ── Cell Navigation (Phase 4) ────────────────────────────────────────

/**
 * Returns functions to navigate between cells in a row.
 *
 * Tab moves right through the `editableColumnIds` list. Shift+Tab moves
 * left. At the last column, Tab does nothing (no row-wrapping for MVP).
 *
 * @param editableColumnIds — ordered list of column IDs that support editing
 *
 * @example
 * const { moveToNextCell, moveToPrevCell } = useCellNavigator(["name", "email", "department"]);
 * moveToNextCell(`${rowId}:name`); // sets editingCellIdAtom to `${rowId}:email`
 */
export function useCellNavigator(editableColumnIds: string[]) {
  const set = useSetAtom(editingCellIdAtom);

  const moveToNextCell = (currentCellId: string) => {
    const { rowId, columnId } = parseCellId(currentCellId);
    const idx = editableColumnIds.indexOf(columnId);
    if (idx >= 0 && idx < editableColumnIds.length - 1) {
      set(buildCellId(rowId, editableColumnIds[idx + 1]));
    }
  };

  const moveToPrevCell = (currentCellId: string) => {
    const { rowId, columnId } = parseCellId(currentCellId);
    const idx = editableColumnIds.indexOf(columnId);
    if (idx > 0) {
      set(buildCellId(rowId, editableColumnIds[idx - 1]));
    }
  };

  return { moveToNextCell, moveToPrevCell } as const;
}
