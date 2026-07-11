import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";

import {
  tableRowSelectionStateFamily,
  toggleRowSelectionAtom,
  selectAllRowsAtom,
  deselectAllRowsAtom,
} from "../states/atoms/row-selection-state";

/**
 * Hook: table row selection state + handlers.
 */
export function useTableRowSelection(instanceId: string, allRowIds: string[]) {
  const selection = useAtomValue(tableRowSelectionStateFamily(instanceId));
  const toggleRow = useSetAtom(toggleRowSelectionAtom);
  const selectAll = useSetAtom(selectAllRowsAtom);
  const deselectAll = useSetAtom(deselectAllRowsAtom);

  const { selectedIds } = selection;

  const isSelected = useCallback((rowId: string) => selectedIds.has(rowId), [selectedIds]);

  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      deselectAll({ instanceId });
    } else {
      selectAll({ instanceId, rowIds: allRowIds });
    }
  }, [instanceId, allRowIds, allSelected, selectAll, deselectAll]);

  const handleToggleRow = useCallback(
    (rowId: string) => {
      toggleRow({ instanceId, rowId });
    },
    [instanceId, toggleRow],
  );

  return useMemo(
    () => ({
      selectedIds,
      isSelected,
      allSelected,
      handleSelectAll,
      handleToggleRow,
    }),
    [selectedIds, isSelected, allSelected, handleSelectAll, handleToggleRow],
  );
}
