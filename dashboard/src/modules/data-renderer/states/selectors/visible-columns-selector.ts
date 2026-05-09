import { atom } from "jotai";
import { tableColumnVisibilityStateFamily } from "../atoms/column-visibility-state";
import type { ColumnDefinition, FieldMetadata } from "../../types";

/**
 * Returns an atom that filters columns by visibility for a given table instance.
 *
 * Columns not in the visibility map are considered visible by default.
 */
export function visibleColumnsSelector<T extends FieldMetadata>(
  instanceId: string,
  allColumns: ColumnDefinition<T>[],
) {
  return atom((get) => {
    const visibilityMap = get(tableColumnVisibilityStateFamily(instanceId));
    if (visibilityMap.size === 0) return allColumns;
    return allColumns.filter(
      (col) => visibilityMap.get(col.id) !== false,
    );
  });
}
