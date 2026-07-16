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
	/** Additional CSS class for cells in this column. */
	cellClassName?: string;
	/**
	 * Explicitly override the display type for this column.
	 * When set, this takes precedence over schema-based type inference.
	 * Use "reference" for FK fields, "status" for status badges, etc.
	 */
	displayType?: import("@/modules/data-renderer/types").FieldType;
}

/**
 * Per-entity map of field name → presentation overrides.
 */
export const PRESENTATION_OVERRIDES: Record<string, Record<string, ColumnPresentation>> = {
	punch: {
		timestamp: { width: "180px" },
		user_pin: { width: "120px", displayType: "reference" },
		device_sn: { width: "150px", displayType: "reference" },
		status: { width: "120px", displayType: "status" },
		verify_mode: { width: "110px", displayType: "enum" },
		employee_name: { width: "160px", displayType: "reference" },
		device_label: { width: "150px" },
	},
	device: {
		label: { width: "180px" },
		serial_number: { width: "160px" },
		host: { width: "140px" },
		port: { width: "80px", align: "center" },
		vendor: { width: "110px" },
		connection_status: { width: "130px", displayType: "status" },
		push_enabled: { width: "100px", align: "center" },
		last_seen_at: { width: "160px" },
	},
	employee: {
		pin: { width: "120px" },
		name: { width: "200px" },
		department: { width: "150px", displayType: "reference" },
		external_id: { width: "130px" },
		active: { width: "100px", align: "center", displayType: "status" },
		created_at: { width: "160px" },
	},
	department: {
		name: { width: "220px" },
		employee_count: { width: "120px", align: "center" },
		created_at: { width: "160px" },
	},
	audit: {
		timestamp: { width: "180px" },
		actor: { width: "140px" },
		action: { width: "120px" },
		resource: { width: "150px" },
		status: { width: "100px", align: "center", displayType: "status" },
		ip_address: { width: "130px" },
	},
};

// ── Reference Configuration ─────────────────────────────────────────────

/**
 * Describes a reference/FK field: which entity it navigates to.
 *
 * This is the SINGLE place that maps domain field names to their
 * navigation targets. The data-renderer infrastructure never knows
 * about "device_sn" or "user_pin" — it only knows about "reference"
 * fields with an entity target.
 */
export interface ReferenceConfig {
	/** The entity type to navigate to when the reference chip is clicked. */
	referenceEntity: import("@/types/entities").EntityType;
	/** Field on the row containing the target entity ID. Defaults to the field itself. */
	referenceIdField?: string;
	/** Optional: field on the row containing the display label (e.g., "employee_name" for "user_pin"). */
	displayField?: string;
}

/**
 * Per-entity, per-field reference configuration.
 *
 * Only fields that are FK references need an entry here.
 * The schema mapper reads this to build `ReferenceFieldMetadata`.
 */
export const REFERENCE_CONFIG: Record<string, Record<string, ReferenceConfig>> = {
	punch: {
		device_sn: {
			referenceEntity: "device",
			referenceIdField: "device_sn",
			displayField: "device_label",
		},
		user_pin: {
			referenceEntity: "user",
			referenceIdField: "user_pin",
		},
		employee_name: {
			referenceEntity: "user",
			referenceIdField: "user_pin",
			displayField: "employee_name",
		},
	},
	employee: {
		department: {
			referenceEntity: "department",
			referenceIdField: "department_id",
			displayField: "department",
		},
	},
};
