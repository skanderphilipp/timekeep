/**
 * Data Renderer Module — Unified data object rendering for Alsabah.
 *
 * Generic field types describe DATA SHAPE, not domain meaning.
 * Domain behavior (navigation target, options, formatting) lives
 * in metadata from `@/types/metadata.ts` (REFERENCE_CONFIG, PRESENTATION_OVERRIDES).
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  EntityType, FieldType, FieldMetadata, FieldDefinition, ColumnDefinition,
  SortDirection, SortEntry, FilterEntry, PaginationState, RowSelectionState,
  TextFieldMetadata, NumberFieldMetadata,
  TimestampFieldMetadata, StatusFieldMetadata, EnumFieldMetadata,
  ReferenceFieldMetadata, ArrayFieldMetadata, BooleanFieldMetadata, TagColor,
} from "./types";

// ── Guards ─────────────────────────────────────────────────────────────────
export {
  isFieldText, isFieldNumber, isFieldTimestamp,
  isFieldStatus, isFieldEnum, isFieldReference,
} from "./guards";

// ── Contexts ───────────────────────────────────────────────────────────────
export {
  DataTableContext, useDataTableContext,
  DataTableRowContext, useDataTableRowContext,
  DataTableCellContext, useDataTableCellContext,
  FieldContext, useFieldContext,
} from "./contexts";
export type { FieldViewMode } from "./contexts/field-context";

// ── States ─────────────────────────────────────────────────────────────────
export {
  tableSortFamilyState, tableFilterFamilyState,
  tableRowSelectionFamilyState, toggleRowSelectionAtom,
  selectAllRowsAtom, deselectAllRowsAtom,
  tableColumnVisibilityFamilyState, tableLoadingFamilyState,
} from "./states";

// ── Field Displays ──────────────────────────────────────────────────────────
export { FieldDisplay } from "./field-displays/index";
export { TextFieldDisplay } from "./field-displays/text-field-display";
export { TimestampFieldDisplay } from "./field-displays/timestamp-field-display";
export { EnumFieldDisplay } from "./field-displays/enum-field-display";
export { ReferenceFieldDisplay } from "./field-displays/reference-field-display";
export { ArrayFieldDisplay } from "./field-displays/array-field-display";

// ── Field Inputs ────────────────────────────────────────────────────────────
export { FieldEdit } from "./field-inputs/index";

// ── Hooks ──────────────────────────────────────────────────────────────────
export {
  useCellClickHandler, useTableInstanceId,
  useTableSort, useTableFilter, useTableRowSelection,
  useColumnDefinitions, useSchemaColumns,
  useFilterFields, useFacetSearch,
} from "./hooks";
export type {
  FilterDimensionMeta, FilterRenderContext,
  UseFilterFieldsResult, FacetSearchMeta,
  UseFacetSearchOptions, UseFacetSearchResult, FacetOptionItem,
} from "./hooks";

// ── Components ─────────────────────────────────────────────────────────────
export {
  DataTableContainer, DataTableFooter, DataTableRow,
  createCellRenderer, createEditableCellRenderer,
  DataListView, ReferenceFacetSelector,
} from "./components";
export type {
  DataListViewProps, ReferenceFacetSelectorProps, CellEditingConfig,
} from "./components";

// ── Filter Renderer ────────────────────────────────────────────────────────
export { renderFilterDimensions } from "./components/filter-field-renderers";

// ── Schema Mapper ──────────────────────────────────────────────────────────
export {
  mapSchemaFieldToFieldType,
  columnMetaToDefinition,
  getPresentationOverride,
} from "./schema-mapper";

// ── Column Definitions ─────────────────────────────────────────────────────
// Kept for backward compat with stories/tests and schema-loading fallback.
export { createPunchColumns } from "./column-definitions/punch-columns";
export { createDeviceColumns } from "./column-definitions/device-columns";
export { createUserColumns } from "./column-definitions/user-columns";
export { createApiKeyColumns } from "./column-definitions/api-key-columns";
export { createAuditColumns } from "./column-definitions/audit-columns";
export { createEmployeeColumns } from "./column-definitions/employee-columns";
