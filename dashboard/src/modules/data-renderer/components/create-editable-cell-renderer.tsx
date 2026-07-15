import { type ReactNode } from "react";
import { EditableCell } from "@/components/ui/data-table";
import type { EditableCellEditProps } from "@/components/ui/data-table";
import {
  DataTableCellContext,
  type DataTableCellContextValue,
} from "../contexts/data-table-cell-context";
import { FieldContext, type FieldContextValue } from "../contexts/field-context";
import { FieldDisplay } from "../field-displays";
import { FieldEdit } from "../field-inputs/index";
import type { ColumnDefinition, FieldMetadata } from "../types";

/**
 * Editing configuration passed from the table container to the cell renderer.
 */
export type CellEditingConfig = {
  /** Called when the user commits a cell edit (Enter, Tab, ClickOutside). */
  onPersist: (rowId: string, field: string, value: unknown) => void;
  /** Ordered list of column IDs that support inline editing (for Tab navigation). */
  editableColumns: string[];
};

/**
 * Creates a cell renderer that supports inline editing via {@link EditableCell}.
 *
 * Builds on `createCellRenderer`'s context hierarchy (DataTableCellContext +
 * FieldContext). When the column's `editable` flag is true and `editingConfig`
 * is provided, the cell becomes click-to-edit with Tab navigation between
 * editable columns.
 *
 * The display mode uses {@link FieldDisplay} (the existing type dispatcher).
 * The edit mode uses {@link FieldEdit} (the new edit dispatcher).
 *
 * @example
 * ```ts
 * const columns = schemaColumns.map(col => ({
 *   ...col,
 *   cell: createEditableCellRenderer(col, onCellClick, getRowKey, editingConfig),
 * }));
 * ```
 */
export function createEditableCellRenderer<T extends Record<string, unknown>>(
  column: ColumnDefinition<FieldMetadata>,
  onCellClick?: (columnId: string, recordId: string) => void,
  getRecordId?: (row: T) => string,
  editingConfig?: CellEditingConfig,
): (row: T) => ReactNode {
  const isEditable = column.editable && editingConfig;

  return (row: T) => {
    const recordId = getRecordId ? getRecordId(row) : "";
    const rawValue = (row as Record<string, unknown>)[column.fieldId] ?? "";

    // Custom render takes priority
    if (column.render) {
      return column.render(row);
    }

    // Resolve display labels and navigation IDs per column type
    let entityId: string | undefined;
    if (column.type === "employee_name") {
      const pin = (row as Record<string, unknown>)["user_pin"];
      entityId = pin ? String(pin) : undefined;
    } else if (column.type === "user_pin") {
      entityId = String(rawValue);
    }

    const value = rawValue;
    const isClickable =
      column.type === "device_sn" ||
      column.type === "employee_name" ||
      !!column.isLabelIdentifier;

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

    // Build the context-wrapped display component (shared by both render modes)
    const displayNode = (
      <DataTableCellContext.Provider value={cellContextValue}>
        <FieldContext.Provider value={fieldContextValue}>
          <FieldDisplay />
        </FieldContext.Provider>
      </DataTableCellContext.Provider>
    );

    // Non-editable: plain display (backward-compatible behavior)
    if (!isEditable) {
      return displayNode;
    }

    // Editable: wrap in EditableCell with FieldDisplay (read) and FieldEdit (edit)
    const editNode = (editProps: EditableCellEditProps<unknown>) => (
      <DataTableCellContext.Provider value={cellContextValue}>
        <FieldContext.Provider value={fieldContextValue}>
          <FieldEdit {...editProps} />
        </FieldContext.Provider>
      </DataTableCellContext.Provider>
    );

    return (
      <EditableCell<unknown>
        rowId={recordId}
        columnId={column.id}
        value={value}
        renderDisplay={() => displayNode}
        renderEdit={editNode}
        onPersist={editingConfig!.onPersist}
        editableColumns={editingConfig!.editableColumns}
      />
    );
  };
}
