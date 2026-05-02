import { createContext, useContext } from "react";
import type { EntityType } from "../types";

/**
 * DataTable context — scoped to a single table instance.
 *
 * Provides the table's identity (instanceId), entity type, and
 * the cell-click handler that routes to the correct detail panel.
 *
 * Pattern: analogous to pulse's `RecordTableContext`.
 */
export type DataTableContextValue = {
  /** Unique ID for this table instance — scopes Jotai atoms. */
  instanceId: string;
  /** The entity type this table displays. */
  entityType: EntityType;
  /** Called when a clickable cell is clicked. Routes to entity detail. */
  onCellClick: (entityType: EntityType, entityId: string) => void;
  /** Trigger event type for navigation (default: CLICK). */
  triggerEvent?: "CLICK" | "MOUSE_DOWN";
};

const DataTableContext = createContext<DataTableContextValue | null>(null);

export function useDataTableContext(): DataTableContextValue {
  const ctx = useContext(DataTableContext);
  if (!ctx) {
    throw new Error(
      "useDataTableContext must be used within a DataTableContextProvider",
    );
  }
  return ctx;
}

export { DataTableContext };
