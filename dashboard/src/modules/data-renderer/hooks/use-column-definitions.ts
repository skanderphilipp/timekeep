import { useMemo } from "react";
import type { ColumnDefinition, FieldMetadata } from "../types";

/**
 * Hook: generates column definitions from an entity type.
 *
 * Returns the appropriate column array filtered to only visible columns.
 * The entityType parameter is reserved for future use when columns
 * are data-driven from an API schema.
 */
export function useColumnDefinitions<T extends FieldMetadata>(
  _entityType: string,
  columns: ColumnDefinition<T>[],
): ColumnDefinition<T>[] {
  return useMemo(() => columns.filter((col) => col.isVisible !== false), [columns]);
}
