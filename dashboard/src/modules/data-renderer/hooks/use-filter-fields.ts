/**
 * useFilterFields — generic schema-driven filter field metadata hook.
 *
 * Reads the entity schema to discover which columns are filterable and
 * returns structured metadata + context type for building FilterField[].
 * The view component maps metadata to FilterField[] with entity-specific
 * render functions via `renderFilterDimensions()`.
 */

import { useMemo } from "react";

import { useSchemaColumns } from "./use-schema-columns";
import type { FacetKind } from "@/lib/api";
import type { DateRangePreset } from "@/components/ui";

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Normalize `facet_kind` from the backend schema.
 *
 * The backend returns `facet_kind` as either:
 *   - A string: `"reference"` | `"enum"`
 *   - An object: `{ type: "reference" }` | `{ type: "enum" }`
 *
 * Both formats are normalized to a plain string or null.
 */
function normalizeFacetKind(raw: unknown): FacetKind | null {
	if (raw === null || raw === undefined) return null;
	if (typeof raw === "string") return raw as FacetKind;
	if (typeof raw === "object" && raw !== null && "type" in raw) {
		return (raw as { type: string }).type as FacetKind;
	}
	return null;
}

// ── Types ───────────────────────────────────────────────────────────────

/** Describes a single filterable dimension from the schema or entity config. */
export type FilterDimensionMeta = {
	field: string;
	label: string;
	facetKind: FacetKind | null;
	uiKind: "enum" | "reference" | "date-range" | "toggle";
};

/** Context for reference facet search-as-you-type. */
export type FacetSearchMeta = {
	entity: string;
	dimension: string;
	/** Active filter context for contextual counts (since, until, status, etc.). */
	context?: Record<string, unknown>;
};

/** Context the view component needs to render each filter dimension. */
export type FilterRenderContext = {
	values: Record<string, string | undefined>;
	handlers: Record<string, (value: string) => void>;
	enumOptions: Record<string, { value: string; label: string }[]>;
	/** Search-as-you-type config for reference facets, keyed by field name. */
	facetSearch?: Record<string, FacetSearchMeta>;
	dateRange?: {
		from: Date | null;
		to: Date | null;
		onChange: (from: Date | null, to: Date | null | undefined) => void;
		presets?: DateRangePreset[];
	};
	toggles?: Record<string, { checked: boolean; onChange: (checked: boolean) => void; label: string }>;
};

export type UseFilterFieldsResult = {
	dimensions: FilterDimensionMeta[];
	isLoading: boolean;
};

// ── Entity-level dimensions ─────────────────────────────────────────────

const ENTITY_EXTRAS: Record<string, FilterDimensionMeta[]> = {
	punch: [
		{ field: "date_range", label: "Date Range", facetKind: null, uiKind: "date-range" },
		{ field: "anomalies_only", label: "Anomalies", facetKind: null, uiKind: "toggle" },
	],
	audit: [
		{ field: "date_range", label: "Date Range", facetKind: null, uiKind: "date-range" },
	],
};

// ── Hook ────────────────────────────────────────────────────────────────

export function useFilterFields(entity: string): UseFilterFieldsResult {
	const { schema, isLoading } = useSchemaColumns(entity);

	const dimensions = useMemo<FilterDimensionMeta[]>(() => {
		const dims: FilterDimensionMeta[] = [];

		if (schema) {
			for (const col of schema.columns) {
				if (!col.filterable) continue;

				const facetKind = normalizeFacetKind(col.facet_kind);

				dims.push({
					field: col.field,
					label: col.label,
					facetKind,
					uiKind: facetKind === "reference" ? "reference" : "enum",
				});
			}
		}

		const extras = ENTITY_EXTRAS[entity] ?? [];
		for (const extra of extras) {
			dims.push(extra);
		}

		return dims;
	}, [schema, entity]);

	return { dimensions, isLoading };
}
