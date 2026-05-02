import { createContext, useContext } from "react";
import type { ColumnDefinition, FieldMetadata } from "../types";

/**
 * DataTable cell context — scoped to a single cell.
 *
 * Provides the field definition and column metadata for the cell.
 * Pattern: analogous to pulse's `RecordTableCellContext`.
 */
export type DataTableCellContextValue = {
  /** The column definition for this cell (includes field type, metadata, etc.). */
  column: ColumnDefinition<FieldMetadata>;
  /** Raw cell value from the row data. */
  value: unknown;
  /** The record's unique ID. */
  recordId: string;
  /** Whether this cell is clickable / interactive. */
  isClickable: boolean;
};

const DataTableCellContext = createContext<DataTableCellContextValue | null>(null);

export function useDataTableCellContext(): DataTableCellContextValue {
  const ctx = useContext(DataTableCellContext);
  if (!ctx) {
    throw new Error(
      "useDataTableCellContext must be used within a DataTableCellContextProvider",
    );
  }
  return ctx;
}

export { DataTableCellContext };
