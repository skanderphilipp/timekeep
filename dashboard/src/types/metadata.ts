/**
 * Metadata System Types
 *
 * Maps the backend's Entity Schema + Facet system to frontend types.
 * These are the single source of truth for all schema-driven rendering.
 *
 * Backend endpoints:
 *   GET /api/{entity}/schema   → ApiEnvelope<EntitySchema>
 *   GET /api/{entity}/filters  → ApiEnvelope<FacetGroup[]>
 */

// ── Column Metadata (from schema endpoint) ─────────────────────────────

/** Backend primitive type for a column value. */
export type CursorValueType = "int" | "text";

/** How a filterable column behaves in the UI. */
export type FacetKind = "enum" | "reference";

/** Single column descriptor returned by the schema endpoint. */
export interface ColumnMeta {
	field: string;
	label: string;
	value_type: CursorValueType;
	sortable: boolean;
	filterable: boolean;
	facet_kind: FacetKind | null;
}

/** Full entity schema returned by GET /api/{entity}/schema. */
export interface EntitySchema {
	entity: string;
	columns: ColumnMeta[];
	default_sort: string;
	default_sort_order: "asc" | "desc";
	tiebreaker: string;
}

// ── Facet Metadata (from filters endpoint) ─────────────────────────────

/** A single selectable value in a facet dimension. */
export interface FacetOption {
	value: string;
	label: string;
	count?: number | null;
}

/** One facet dimension with its available values. */
export interface FacetGroup {
	key: string;
	label: string;
	kind: FacetKind;
	options: FacetOption[];
	has_more: boolean;
	total?: number | null;
}

// ── API Envelope (shared across all metadata endpoints) ────────────────

export interface ApiEnvelope<T> {
	data: T;
	meta: PageMeta | null;
	error: ApiError | null;
}

export interface PageMeta {
	has_more: boolean;
	next_cursor: string | null;
	total: number | null;
}

export interface ApiError {
	code: string;
	message: string;
	fields?: { field: string; message: string }[];
}

// ── Presentation Overrides ─────────────────────────────────────────────

/**
 * Per-column presentation hints that the schema doesn't provide.
 *
 * The backend owns structural metadata (sortability, filterability, type).
 * The frontend owns presentation (width, alignment, label-identifier role).
 * This map bridges the gap for known fields. Unknown fields get sensible defaults.
 */
export interface ColumnPresentation {
	/** Fixed column width (CSS value, e.g. "120px"). */
	width?: string;
	/** Column text alignment. */
	align?: "left" | "center" | "right";
	/** Whether this column is the row's label/identifier (renders as Chip). */
	isLabelIdentifier?: boolean;
	/** Additional CSS class for cells in this column. */
	cellClassName?: string;
}

/**
 * Per-entity map of field name → presentation overrides.
 */
export const PRESENTATION_OVERRIDES: Record<string, Record<string, ColumnPresentation>> = {
	punch: {
		timestamp: { width: "180px" },
		user_pin: { width: "120px" },
		device_sn: { width: "150px", isLabelIdentifier: true },
		status: { width: "120px" },
		verify_mode: { width: "110px" },
		employee_name: { width: "160px", isLabelIdentifier: true },
		device_label: { width: "150px" },
	},
	device: {
		label: { width: "180px", isLabelIdentifier: true },
		serial_number: { width: "160px" },
		host: { width: "140px" },
		port: { width: "80px", align: "center" },
		vendor: { width: "110px" },
		connection_status: { width: "130px" },
		push_enabled: { width: "100px", align: "center" },
		last_seen_at: { width: "160px" },
	},
	employee: {
		pin: { width: "120px" },
		name: { width: "200px", isLabelIdentifier: true },
		department: { width: "150px" },
		external_id: { width: "130px" },
		active: { width: "100px", align: "center" },
		created_at: { width: "160px" },
	},
	audit: {
		timestamp: { width: "180px" },
		actor: { width: "140px" },
		action: { width: "120px", isLabelIdentifier: true },
		resource: { width: "150px" },
		status: { width: "100px", align: "center" },
		ip_address: { width: "130px" },
	},
};
