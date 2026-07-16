import { type ReactNode } from "react";
import {
  DataTableCellContext,
  type DataTableCellContextValue,
} from "../contexts/data-table-cell-context";
import { FieldContext, type FieldContextValue } from "../contexts/field-context";
import { FieldDisplay } from "../field-displays";
import type { ColumnDefinition, FieldMetadata, ReferenceFieldMetadata } from "../types";

// ── Cell renderer factory ──────────────────────────────────────────────────

/**
 * Creates a cell renderer function compatible with `DataTableColumnV2.render`.
 *
 * This is the bridge between our `ColumnDefinition` + `FieldDisplay` architecture
 * and the existing `DataTableV2` component. Instead of building a parallel table,
 * we inject our context hierarchy + field dispatcher as a cell renderer.
 *
 * For `reference` columns: the cell is clickable and resolves the navigation
 * target from `ReferenceFieldMetadata.referenceEntity`. Clicking the cell
 * navigates to the referenced entity's detail panel.
 *
 * Returns a function `(row: T) => ReactNode` that `DataTableV2` can use directly.
 */
export function createCellRenderer<T extends Record<string, unknown>>(
  column: ColumnDefinition<FieldMetadata>,
  _onCellClick?: (columnId: string, recordId: string) => void,
  getRecordId?: (row: T) => string,
): (row: T) => ReactNode {
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
export {
  DataTableCellContext,
  type DataTableCellContextValue,
} from "../contexts/data-table-cell-context";
export {
  DataTableRowContext,
  type DataTableRowContextValue,
} from "../contexts/data-table-row-context";
export { FieldContext, type FieldContextValue } from "../contexts/field-context";
