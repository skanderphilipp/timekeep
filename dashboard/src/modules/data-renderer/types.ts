/**
 * Data Renderer — Core Types
 *
 * Generic field types describe DATA SHAPE, not domain meaning.
 * Domain behavior (navigation target, options, formatting) lives in metadata.
 *
 * Design: discriminated union on `type`, dispatched via guard functions.
 */

// ── Entity types ─────────────────────────────────────────────────────────

export type { EntityType } from "@/types/entities";

// ── Field types ──────────────────────────────────────────────────────────

/**
 * Generic field type discriminants.
 *
 * These describe what a field IS, not what it MEANS:
 *   - `text`      → plain string display
 *   - `number`    → formatted number display
 *   - `timestamp` → formatted date/time
 *   - `status`    → colored tag with option labels (no navigation)
 *   - `enum`      → colored tag with option labels (no navigation)
 *   - `reference` → clickable chip that navigates to another entity
 *
 * Domain-specific types like `device_sn`, `user_pin`, `employee_name`
 * are NOT valid field types. They are `reference` fields with
 * entity-specific metadata.
 */
export type FieldType =
  | "text"
  | "number"
  | "timestamp"
  | "status"
  | "enum"
  | "reference"
  | "array";

// ── Field metadata (type-specific) ───────────────────────────────────────

export interface BaseFieldMetadata {
  fieldName: string;
  isSortable?: boolean;
}

// ── Text ─────────────────────────────────────────────────────────────────

export interface TextFieldMetadata extends BaseFieldMetadata {
  settings?: null;
  /** When "time", renders a time picker in edit mode. */
  inputType?: "text" | "time";
}

// ── Number ────────────────────────────────────────────────────────────────

export interface NumberFieldMetadata extends BaseFieldMetadata {
  /** Optional formatting: decimal places, locale, etc. */
  format?: "integer" | "decimal";
  settings?: null;
}

// ── Timestamp ─────────────────────────────────────────────────────────────

export interface TimestampFieldMetadata extends BaseFieldMetadata {
  format?: "iso" | "relative" | "date-only" | "time-only";
  settings?: null;
}

// ── Status (colored tag, no navigation) ──────────────────────────────────

export interface StatusFieldMetadata extends BaseFieldMetadata {
  labels?: Record<string, string>;
  colors?: Record<string, TagColor>;
  settings?: null;
}

// ── Enum (colored tag, no navigation, different semantic from status) ────

export interface EnumFieldMetadata extends BaseFieldMetadata {
  labels?: Record<string, string>;
  colors?: Record<string, TagColor>;
  settings?: null;
}

// ── Reference (clickable FK chip, navigates to entity) ───────────────────

export interface ReferenceFieldMetadata extends BaseFieldMetadata {
  /** The entity type to navigate to on click (e.g., "device", "user"). */
  referenceEntity: import("@/types/entities").EntityType;
  /** Field on the row containing the target entity ID. */
  referenceIdField: string;
  /** Optional: field on the row containing the display label. Falls back to raw value. */
  displayField?: string;
  /** Select options when the field is rendered as a dropdown (edit mode). */
  options?: import("@/types/options").ComboboxOption[];
  settings?: null;
}

// ── Array (tag chips for string[] or boolean[] with labels) ─────────────

export interface ArrayFieldMetadata extends BaseFieldMetadata {
  /**
   * When the array values are strings (or booleans), maps each value
   * to a display label. For boolean arrays, use `"true"` / `"false"` keys.
   *
   * @example { true: "Active", false: "Inactive" }
   */
  labels?: Record<string, string>;
  /** Optional color map matching label keys. */
  colors?: Record<string, TagColor>;
  /**
   * Position-based labels for index-to-label mapping.
   * When set, the label for item at index `i` is `positionLabels[i]`.
   * Takes precedence over value-based `labels`.
   *
   * @example ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
   */
  positionLabels?: string[];
  settings?: null;
}

// ── Union type ───────────────────────────────────────────────────────────

export type TagColor = "green" | "red" | "amber" | "blue" | "gray" | "accent";

export type FieldMetadata =
  | TextFieldMetadata
  | NumberFieldMetadata
  | TimestampFieldMetadata
  | StatusFieldMetadata
  | EnumFieldMetadata
  | ReferenceFieldMetadata
  | ArrayFieldMetadata;

// ── Field definition ─────────────────────────────────────────────────────

export type FieldDefinition<T extends FieldMetadata = FieldMetadata> = {
  fieldId: string;
  label: string;
  type: FieldType;
  metadata: T;
};

// ── Column definition ────────────────────────────────────────────────────

export type ColumnDefinition<T extends FieldMetadata = FieldMetadata> = FieldDefinition<T> & {
  header: string;
  id: string;
  width?: string;
  align?: "left" | "center" | "right";
  isVisible?: boolean;
  cellClassName?: string;
  /**
   * Custom render function. When provided, takes precedence over
   * the type-dispatched FieldDisplay. Use this for domain-specific
   * rendering that the generic system can't express.
   * Preferred: configure via metadata. Use render only for truly
   * custom UI (e.g., composed cells, inline charts).
   */
  render?: (row: unknown) => React.ReactNode;
  /**
   * When true, this column supports click-to-edit inline editing.
   * Requires `editingConfig` to be provided by the table container.
   *
   * TODO(ENTERPRISE): Make this schema-driven from the backend.
   * Currently hardcoded per entity in page orchestration hooks.
   * The backend `ColumnMeta` type should eventually carry an
   * `editable: boolean` field so pages don't need per-entity allowlists.
   */
  editable?: boolean;
};

// ── Sort state ───────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export type SortEntry = {
  columnId: string;
  direction: SortDirection;
};

// ── Filter state ─────────────────────────────────────────────────────────

export type FilterEntry = {
  columnId: string;
  value: string;
  operator?: "equals" | "contains" | "starts-with" | "after" | "before";
};

// ── Pagination ───────────────────────────────────────────────────────────

export type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
};

// ── Row selection ────────────────────────────────────────────────────────

export type RowSelectionState = {
  selectedIds: Map<string, boolean>;
};
