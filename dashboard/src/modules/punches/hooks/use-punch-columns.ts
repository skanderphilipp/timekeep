import { useCallback, useMemo, useState } from "react";
import { useLingui } from "@lingui/react";

import { createPunchColumns } from "@/modules/data-renderer/column-definitions/punch-columns";
import type { ColumnDefinition } from "@/modules/data-renderer/types";

/** Columns that are always visible and cannot be toggled off. */
const REQUIRED_COLUMNS = ["timestamp"];

/**
 * Column definitions + user-controlled column visibility for the punch table.
 */
export function usePunchColumns() {
  const { _ } = useLingui();
  const allColumns = useMemo(() => createPunchColumns(_), [_]);

  /** Track which optional columns the user has hidden. */
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  /** Columns currently visible (respects user toggles + required columns). */
  const columns: ColumnDefinition[] = useMemo(
    () =>
      allColumns.map((col) => ({
        ...col,
        isVisible: REQUIRED_COLUMNS.includes(col.id) ? true : !hiddenColumns.has(col.id),
      })),
    [allColumns, hiddenColumns],
  );

  /** Options for the column visibility MultiSelect. */
  const columnOptions = useMemo(
    () =>
      allColumns
        .filter((col) => !REQUIRED_COLUMNS.includes(col.id))
        .map((col) => ({ value: col.id, label: col.header })),
    [allColumns],
  );

  /** Currently selected (visible) column IDs for the MultiSelect. */
  const visibleColumnIds = useMemo(
    () => columns.filter((c) => c.isVisible).map((c) => c.id),
    [columns],
  );

  const handleColumnToggle = useCallback(
    (selectedIds: string[]) => {
      const visibleSet = new Set(selectedIds);
      setHiddenColumns(
        new Set(
          allColumns
            .filter((c) => !REQUIRED_COLUMNS.includes(c.id) && !visibleSet.has(c.id))
            .map((c) => c.id),
        ),
      );
    },
    [allColumns],
  );

  return { columns, columnOptions, visibleColumnIds, handleColumnToggle };
}
