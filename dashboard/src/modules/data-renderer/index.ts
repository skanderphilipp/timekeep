/**
 * Data Renderer Module — Unified data object rendering for Alsabah.
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  EntityType, FieldType, FieldMetadata, FieldDefinition, ColumnDefinition,
  SortDirection, SortEntry, FilterEntry, PaginationState, RowSelectionState,
  TextFieldMetadata, DeviceSnFieldMetadata, UserPinFieldMetadata,
  EmployeeNameFieldMetadata,
  TimestampFieldMetadata, StatusFieldMetadata, DirectionFieldMetadata,
} from "./types";

// ── Guards ─────────────────────────────────────────────────────────────────
export { isFieldText, isFieldDeviceSn, isFieldUserPin, isFieldEmployeeName, isFieldTimestamp, isFieldStatus, isFieldDirection } from "./guards";

// ── Contexts ───────────────────────────────────────────────────────────────
export { DataTableContext, useDataTableContext, DataTableRowContext, useDataTableRowContext, DataTableCellContext, useDataTableCellContext, FieldContext, useFieldContext } from "./contexts";

// ── States ─────────────────────────────────────────────────────────────────
export { tableSortFamilyState, tableFilterFamilyState, tableRowSelectionFamilyState, toggleRowSelectionAtom, selectAllRowsAtom, deselectAllRowsAtom, tableColumnVisibilityFamilyState, tableLoadingFamilyState } from "./states";

// ── Field Displays ──────────────────────────────────────────────────────────
export { FieldDisplay } from "./field-displays/index";
export { TextFieldDisplay } from "./field-displays/text-field-display";
export { DeviceSnFieldDisplay } from "./field-displays/device-sn-field-display";
export { UserPinFieldDisplay } from "./field-displays/user-pin-field-display";
export { TimestampFieldDisplay } from "./field-displays/timestamp-field-display";
export { StatusFieldDisplay } from "./field-displays/status-field-display";
export { DirectionFieldDisplay } from "./field-displays/direction-field-display";

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useCellClickHandler, useTableInstanceId, useTableSort, useTableFilter, useTableRowSelection, useColumnDefinitions, useSchemaColumns, useFilterFields, useFacetSearch } from "./hooks";
export type { FilterDimensionMeta, FilterRenderContext, UseFilterFieldsResult, FacetSearchMeta, UseFacetSearchOptions, UseFacetSearchResult, FacetOptionItem } from "./hooks";

// ── Components ─────────────────────────────────────────────────────────────
export { DataTableContainer, DataTableFooter, DataTableRow, createCellRenderer, DataListView, ReferenceFacetSelector } from "./components";
export type { DataListViewProps, ReferenceFacetSelectorProps } from "./components";

// ── Filter Renderer ────────────────────────────────────────────────────────
export { renderFilterDimensions } from "./components/filter-field-renderers";

// ── Schema Mapper ──────────────────────────────────────────────────────────
export { mapSchemaFieldToFieldType, columnMetaToDefinition, getPresentationOverride } from "./schema-mapper";

// ── Column Definitions ─────────────────────────────────────────────────────
// Active: punch (still used as schema fallback in use-punch-columns.ts)
export { createPunchColumns } from "./column-definitions/punch-columns";
// Deprecated — pages now use useSchemaColumns() instead.
// Files kept for backward compat (stories, tests). Remove once migration complete.
export { createDeviceColumns } from "./column-definitions/device-columns";
export { createUserColumns } from "./column-definitions/user-columns";
export { createApiKeyColumns } from "./column-definitions/api-key-columns";
export { createAuditColumns } from "./column-definitions/audit-columns";
export { createEmployeeColumns } from "./column-definitions/employee-columns";
