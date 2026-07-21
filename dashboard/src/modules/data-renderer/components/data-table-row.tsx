import { useMemo } from "react";
import { DataTableRowContext } from "../contexts/data-table-row-context";
import { createCellRenderer } from "./data-table-cell";
import type { ColumnDefinition, FieldMetadata, EntityType } from "../types";

type DataTableRowProps<T> = {
  row: T;
  rowKey: string;
  rowIndex: number;
  isSelected: boolean;
  entityType: EntityType;
  columns: ColumnDefinition<FieldMetadata>[];
  onCellClick?: (columnId: string, recordId: string) => void;
};

/**
 * Data table row — standalone component for manually composed tables.
 *
 * Provides `DataTableRowContext` to descendants and renders cells
 * using `createCellRenderer`. Used when building a custom table
 * outside of `DataTableContainer`.
 */
export function DataTableRow<T extends Record<string, unknown>>({
  row,
  rowKey,
  rowIndex,
  isSelected,
  entityType,
  columns,
  onCellClick,
}: DataTableRowProps<T>) {
  const rowContextValue = useMemo(
    () => ({
      recordId: rowKey,
      rowIndex,
      isSelected,
      entityType,
    }),
    [rowKey, rowIndex, isSelected, entityType],
  );

  return (
    <DataTableRowContext.Provider value={rowContextValue}>
      {columns.map((col) => {
        const renderFn = createCellRenderer(col, onCellClick, () => rowKey);
        return (
          <td key={col.id} data-slot="data-table-cell" data-column={col.id} className={col.cellClassName}>
            {renderFn(row)}
          </td>
        );
      })}
    </DataTableRowContext.Provider>
  );
}
