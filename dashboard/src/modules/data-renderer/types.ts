/**
 * Data Renderer — Core Types
 *
 * Models the Alsabah domain's 6 field types (not pulse's 30+).
 *
 * Design: each field type is a discriminated union on `type`, making it
 * type-safe to dispatch on via guard functions. This replaces the current
 * `CellType` + manual switch pattern in `DataTableV2`.
 */

// ── Entity types ─────────────────────────────────────────────────────────

/**
 * The entity/table this column belongs to.
 *
 * Used by cell-click routing: clicking a user PIN in the punch table
 * opens user detail, while clicking the punch row opens device detail.
 */
export type { EntityType } from "@/types/entities";

// ── Field types ──────────────────────────────────────────────────────────

/** Discriminants for Alsabah's 7 field types. */
export type FieldType =
  | "text"
  | "device_sn"
  | "user_pin"
  | "employee_name"
  | "timestamp"
  | "status"
  | "direction"
  | "verify_method";

// ── Field metadata (type-specific) ───────────────────────────────────────

export interface BaseFieldMetadata {
  fieldName: string;
  isSortable?: boolean;
}

export interface TextFieldMetadata extends BaseFieldMetadata {
  settings?: null;
}

export interface DeviceSnFieldMetadata extends BaseFieldMetadata {
  settings?: null;
}

export interface UserPinFieldMetadata extends BaseFieldMetadata {
  settings?: null;
}

export interface EmployeeNameFieldMetadata extends BaseFieldMetadata {
  settings?: null;
}

export interface TimestampFieldMetadata extends BaseFieldMetadata {
  format?: "iso" | "relative" | "date-only" | "time-only";
  settings?: null;
}

/**
 * Status metadata: maps raw status codes to human labels + colors.
 *
 * Not a full enum because devices have different status code sets.
 * Consumer provides a lookup map.
 */
export interface StatusFieldMetadata extends BaseFieldMetadata {
  labels?: Record<string, string>;
  /** Color variants for each status code. Must match TagColor from @/components/ui/tag. */
  colors?: Record<string, "green" | "red" | "amber" | "blue" | "gray" | "accent">;
  settings?: null;
}

export interface DirectionFieldMetadata extends BaseFieldMetadata {
  /** Optional: override the default "IN" / "OUT" labels. */
  labels?: { in: string; out: string };
  settings?: null;
}

export interface VerifyMethodFieldMetadata extends BaseFieldMetadata {
  /** Labels for each verify mode value (fingerprint, face, card, password, palm). */
  labels?: Record<string, string>;
  /** Color variants for each verify mode. */
  colors?: Record<string, "green" | "red" | "amber" | "blue" | "gray" | "accent">;
  settings?: null;
}

export type FieldMetadata =
  | TextFieldMetadata
  | DeviceSnFieldMetadata
  | UserPinFieldMetadata
  | EmployeeNameFieldMetadata
  | TimestampFieldMetadata
  | StatusFieldMetadata
  | DirectionFieldMetadata
  | VerifyMethodFieldMetadata;

// ── Field definition (discriminated union) ───────────────────────────────

/**
 * Field definition — analogous to pulse's `FieldDefinition`.
 *
 * Each variant's `type` discriminant enables type-safe guard dispatch:
 *
 * ```ts
 * if (isFieldDeviceSn(field)) return <DeviceSnFieldDisplay />;
 * if (isFieldUserPin(field)) return <UserPinFieldDisplay />;
 * ```
 */
export type FieldDefinition<T extends FieldMetadata = FieldMetadata> = {
  fieldId: string;
  label: string;
  type: FieldType;
  metadata: T;
};

// ── Column definition ────────────────────────────────────────────────────

/**
 * Column definition — the single source of truth for table columns.
 *
 * Extends `FieldDefinition` with table-level metadata (sorting, width, etc.).
 * Rendering is done by the `FieldDisplay` dispatcher based on `type`, not
 * by a manual `render` callback (though custom render is still supported).
 *
 * This is the *one* column type that replaces all three current types
 * (`DataTableColumn`, `DataTableColumnDef`, `DataTableColumnV2`).
 */
export type ColumnDefinition<T extends FieldMetadata = FieldMetadata> = FieldDefinition<T> & {
  /** Column header text shown in the table. */
  header: string;
  /** Unique column identifier. Used for sorting key. */
  id: string;
  /** Fixed column width (CSS value, e.g., "120px"). */
  width?: string;
  /** Column alignment. */
  align?: "left" | "center" | "right";
  /** Whether this column is the row's label/identifier column (renders as Chip). */
  isLabelIdentifier?: boolean;
  /** Whether this column is visible in the current view. */
  isVisible?: boolean;
  /** Additional CSS class for cells in this column. */
  cellClassName?: string;
  /**
   * Optional: manual cell renderer. Takes priority over auto-dispatch.
   * ONLY use for truly custom rendering — prefer `type` + auto-dispatch.
   *
   * Receives the row data and an onClick handler.
   */
  render?: (row: unknown) => React.ReactNode;
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
  /** For future: the operator to apply (equals, contains, etc.). */
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
