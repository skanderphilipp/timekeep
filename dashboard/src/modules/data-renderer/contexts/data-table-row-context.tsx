import { createContext, useContext } from "react";

/**
 * DataTable row context — scoped to a single row in the table.
 *
 * Provides the row's record ID, index, and selection state.
 * Pattern: analogous to pulse's `RecordTableRowContext`.
 */
export type DataTableRowContextValue = {
  /** The record's unique ID (e.g., punch ID, device SN). */
  recordId: string;
  /** Zero-based row index within the current page. */
  rowIndex: number;
  /** Whether this row is currently selected. */
  isSelected: boolean;
  /** The entity type of the row's record. */
  entityType: string;
};

const DataTableRowContext = createContext<DataTableRowContextValue | null>(null);

export function useDataTableRowContext(): DataTableRowContextValue {
  const ctx = useContext(DataTableRowContext);
  if (!ctx) {
    throw new Error("useDataTableRowContext must be used within a DataTableRowContextProvider");
  }
  return ctx;
}

export { DataTableRowContext };
