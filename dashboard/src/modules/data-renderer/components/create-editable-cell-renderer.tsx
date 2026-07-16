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
import type { ColumnDefinition, FieldMetadata, ReferenceFieldMetadata } from "../types";

/**
 * Editing configuration passed from the table container to the cell renderer.
 */
export type CellEditingConfig = {
  onPersist: (rowId: string, field: string, value: unknown) => void;
  editableColumns: string[];
};

/**
 * Creates a cell renderer that supports inline editing via {@link EditableCell}.
 *
 * Display mode uses {@link FieldDisplay} (type dispatcher).
 * Edit mode uses {@link FieldEdit} (type dispatcher).
 *
 * For `reference` fields:
 * - Display: clickable Tag that navigates to the related entity (side panel).
 * - Edit: dropdown editor from metadata options.
 * - Clicking the Tag stops propagation so it doesn't conflict with
 *   the cell's click-to-edit behavior.
 */
export function createEditableCellRenderer<T extends Record<string, unknown>>(
  column: ColumnDefinition<FieldMetadata>,
  _onCellClick?: (columnId: string, recordId: string) => void,
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

    // Generic: all references are clickable
    const isClickable = column.type === "reference";

    // For reference fields, resolve the display value from the display field
    // and the entity ID from the referenceIdField.
    let displayValue = rawValue;
    let resolvedEntityId: string | undefined;
    if (column.type === "reference") {
      const meta = column.metadata as ReferenceFieldMetadata;
      if (meta.displayField) {
        const displayRaw = (row as Record<string, unknown>)[meta.displayField];
        displayValue = displayRaw ?? rawValue;
      }
      const idRaw = (row as Record<string, unknown>)[meta.referenceIdField];
      resolvedEntityId = idRaw ? String(idRaw) : undefined;
    }

    const value = displayValue;

    const cellContextValue: DataTableCellContextValue = {
      column,
      value,
      recordId,
      isClickable,
    };

    const fieldContextValue: FieldContextValue = {
      fieldDefinition: column,
      value,
      viewMode: "display",
      entityId: resolvedEntityId,
    };

    // Display mode rendering
    const displayNode = (
      <DataTableCellContext.Provider value={cellContextValue}>
        <FieldContext.Provider value={fieldContextValue}>
          <FieldDisplay />
        </FieldContext.Provider>
      </DataTableCellContext.Provider>
    );

    if (!isEditable) {
      return displayNode;
    }

    // Edit mode: FieldEdit dispatcher
    const editFieldContextValue: FieldContextValue = {
      ...fieldContextValue,
      viewMode: "edit",
    };

    const editNode = (editProps: EditableCellEditProps<unknown>) => (
      <DataTableCellContext.Provider value={cellContextValue}>
        <FieldContext.Provider value={editFieldContextValue}>
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
