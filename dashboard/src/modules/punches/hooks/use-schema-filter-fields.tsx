/**
 * useSchemaFilterFields — metadata-driven filter field metadata
 *
 * Reads the entity schema to discover which columns are filterable and
 * returns structured metadata about available filters. The view component
 * uses this metadata to build FilterField[] for the FilterDropdown.
 *
 * This replaces the hardcoded filterFields array in PunchQueryView.
 *
 * Currently punch-specific — will generalize when other entities get schemas.
 */

import { useMemo } from "react";

import { useSchemaColumns } from "@/modules/data-renderer/hooks/use-schema-columns";
import type { ColumnMeta } from "@/types/metadata";

// ── Types ───────────────────────────────────────────────────────────────

/** Describes a single filterable column from the schema. */
export type SchemaFilterMeta = {
	/** Backend field name (e.g. "device_sn", "status"). */
	field: string;
	/** Human-readable label from the schema. */
	label: string;
	/** How this filter should be rendered. */
	facetKind: ColumnMeta["facet_kind"];
};

/** Return type: metadata about available filters derived from the schema. */
export type SchemaFilterResult = {
	/** All filterable columns (from schema). */
	filterableColumns: SchemaFilterMeta[];
	/** Whether this entity supports date range filtering. */
	hasDateRange: boolean;
	/** Whether this entity supports an anomalies toggle. */
	hasAnomaliesToggle: boolean;
	/** Whether the schema is still loading. */
	isLoading: boolean;
};

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Derive available filter metadata from the punch entity schema.
 *
 * Returns structured data about which columns are filterable and what
 * extra filters (date range, anomalies) should be shown. The view
 * component is responsible for rendering the actual UI controls.
 *
 * @example
 * ```tsx
 * const { filterableColumns, hasDateRange } = useSchemaFilterFields();
 * // Build FilterField[] from filterableColumns + facet data + handlers
 * ```
 */
export function useSchemaFilterFields(): SchemaFilterResult {
	const { schema, isLoading } = useSchemaColumns("punch");

	const filterableColumns = useMemo<SchemaFilterMeta[]>(() => {
		if (!schema) return [];

		return schema.columns
			.filter((col) => col.filterable)
			.map((col) => ({
				field: col.field,
				label: col.label,
				facetKind: col.facet_kind,
			}));
	}, [schema]);

	return {
		filterableColumns,
		hasDateRange: true, // all time-series entities get date range
		hasAnomaliesToggle: true, // punch-specific
		isLoading,
	};
}
