import { type ReactNode } from "react";
import { DataTableCellContext, type DataTableCellContextValue } from "../contexts/data-table-cell-context";
import { FieldContext, type FieldContextValue } from "../contexts/field-context";
import { FieldDisplay } from "../field-displays";
import type { ColumnDefinition, FieldMetadata } from "../types";

// ── Cell renderer factory ──────────────────────────────────────────────────

/**
 * Creates a cell renderer function compatible with `DataTableColumnV2.render`.
 *
 * This is the bridge between our `ColumnDefinition` + `FieldDisplay` architecture
 * and the existing `DataTableV2` component. Instead of building a parallel table,
 * we inject our context hierarchy + field dispatcher as a cell renderer.
 *
 * Returns a function `(row: T) => ReactNode` that `DataTableV2` can use directly.
 *
 * @example
 * ```ts
 * const columns: DataTableColumnV2<Punch>[] = createPunchColumns(_).map((col) => ({
 *   id: col.id,
 *   header: col.header,
 *   sortable: col.metadata?.isSortable,
 *   width: col.width,
 *   render: createCellRenderer(col, onCellClick),
 * }));
 * ```
 */
export function createCellRenderer<T extends Record<string, unknown>>(
  column: ColumnDefinition<FieldMetadata>,
  onCellClick?: (columnId: string, recordId: string) => void,
  getRecordId?: (row: T) => string,
): (row: T) => ReactNode {
  return (row: T) => {
    const recordId = getRecordId ? getRecordId(row) : "";
    let rawValue = (row as Record<string, unknown>)[column.fieldId] ?? "";

    // Custom render takes priority
    if (column.render) {
      return column.render(row);
    }

    // Resolve display labels: show names instead of IDs when available
    let entityId: string | undefined;
    if (column.type === "user_pin") {
      entityId = String(rawValue); // keep PIN for navigation
      const name = (row as Record<string, unknown>)["employee_name"];
      if (name && typeof name === "string" && name.length > 0) {
        rawValue = name; // show name in the chip
      }
    }

    const value = rawValue;

    const isClickable =
      (column.type === "device_sn" || column.type === "user_pin" || !!column.isLabelIdentifier);

    const handleClick = () => {
      if (isClickable && onCellClick) {
        onCellClick(column.id, recordId);
      }
    };

    const cellContextValue: DataTableCellContextValue = {
      column,
      value,
      recordId,
      isClickable,
    };

    const fieldContextValue: FieldContextValue = {
      fieldDefinition: column,
      value,
      isLabelIdentifier: !!column.isLabelIdentifier,
      onFieldClick: handleClick,
      isEditMode: false,
      entityId,
    };

    return (
      <DataTableCellContext.Provider value={cellContextValue}>
        <FieldContext.Provider value={fieldContextValue}>
          <FieldDisplay />
        </FieldContext.Provider>
      </DataTableCellContext.Provider>
    );
  };
}

// Re-export contexts for convenience
export { DataTableCellContext, type DataTableCellContextValue } from "../contexts/data-table-cell-context";
export { DataTableRowContext, type DataTableRowContextValue } from "../contexts/data-table-row-context";
export { FieldContext, type FieldContextValue } from "../contexts/field-context";
