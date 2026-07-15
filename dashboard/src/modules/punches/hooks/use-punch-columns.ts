import { useCallback, useMemo, useState } from "react";
import { useLingui } from "@lingui/react";

import { createPunchColumns } from "@/modules/data-renderer/column-definitions/punch-columns";
import { useSchemaColumns } from "@/modules/data-renderer/hooks/use-schema-columns";
import type { ColumnDefinition } from "@/modules/data-renderer/types";

/** Columns that are always visible and cannot be toggled off. */
const REQUIRED_COLUMNS = ["timestamp"];

/**
 * Column definitions + user-controlled column visibility for the punch table.
 *
 * Uses schema-driven columns when the backend schema is available.
 * Falls back to hardcoded columns only during loading or if the schema fetch fails.
 */
export function usePunchColumns() {
	const { _ } = useLingui();

	// ── Schema-driven columns (primary source) ────────────────────────────

	const { columns: schemaColumns, isLoading: schemaLoading } = useSchemaColumns("punch");

	// ── Hardcoded columns (fallback only) ──────────────────────────────────

	const hardcodedColumns = useMemo(() => createPunchColumns(_), [_]);

	/** Use schema columns when available, hardcoded only as fallback. */
	const allColumns = useMemo(() => {
		if (!schemaLoading && schemaColumns.length > 0) return schemaColumns;
		if (schemaLoading) return []; // wait for schema
		return hardcodedColumns; // schema failed — use hardcoded
	}, [schemaLoading, schemaColumns, hardcodedColumns]);

	/** Track which optional columns the user has hidden. */
	const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

	/** Columns currently visible (respects user toggles + required columns). */
	const columns: ColumnDefinition[] = useMemo(
		() =>
			allColumns.map((col) => ({
				...col,
				isVisible: REQUIRED_COLUMNS.includes(col.id) ? true : !hiddenColumns.has(col.id),
			})),
		[allColumns, hiddenColumns],
	);

	/** Options for the column visibility dropdown. */
	const columnOptions = useMemo(
		() =>
			allColumns
				.filter((col) => !REQUIRED_COLUMNS.includes(col.id))
				.map((col) => ({ value: col.id, label: col.header })),
		[allColumns],
	);

	/** Currently selected (visible) column IDs. */
	const visibleColumnIds = useMemo(
		() => columns.filter((c) => c.isVisible).map((c) => c.id),
		[columns],
	);

	const handleColumnToggle = useCallback(
		(selectedIds: string[]) => {
			const visibleSet = new Set(selectedIds);
			setHiddenColumns(
				new Set(
					allColumns
						.filter((c) => !REQUIRED_COLUMNS.includes(c.id) && !visibleSet.has(c.id))
						.map((c) => c.id),
				),
			);
		},
		[allColumns],
	);

	return { columns, columnOptions, visibleColumnIds, handleColumnToggle };
}
