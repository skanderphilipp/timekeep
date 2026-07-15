/**
 * Data Renderer Module — Unified data object rendering for Alsabah.
 *
 * Barrel file. Import like:
 *   import { FieldDisplay, isFieldDeviceSn, useTableSort } from "@/modules/data-renderer";
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  EntityType,
  FieldType,
  FieldMetadata,
  FieldDefinition,
  ColumnDefinition,
  SortDirection,
  SortEntry,
  FilterEntry,
  PaginationState,
  RowSelectionState,
  TextFieldMetadata,
  DeviceSnFieldMetadata,
  UserPinFieldMetadata,
  TimestampFieldMetadata,
  StatusFieldMetadata,
  DirectionFieldMetadata,
} from "./types";

// ── Guards ─────────────────────────────────────────────────────────────────
export {
  isFieldText,
  isFieldDeviceSn,
  isFieldUserPin,
  isFieldTimestamp,
  isFieldStatus,
  isFieldDirection,
} from "./guards";

// ── Contexts ───────────────────────────────────────────────────────────────
export {
  DataTableContext,
  useDataTableContext,
  DataTableRowContext,
  useDataTableRowContext,
  DataTableCellContext,
  useDataTableCellContext,
  FieldContext,
  useFieldContext,
} from "./contexts";

// ── States ─────────────────────────────────────────────────────────────────
export {
  tableSortStateFamily,
  tableFilterStateFamily,
  tableRowSelectionStateFamily,
  toggleRowSelectionAtom,
  selectAllRowsAtom,
  deselectAllRowsAtom,
  tableColumnVisibilityStateFamily,
  tableLoadingStateFamily,
} from "./states";

// ── Field Displays ──────────────────────────────────────────────────────────
export { FieldDisplay } from "./field-displays/index";
export { TextFieldDisplay } from "./field-displays/text-field-display";
export { DeviceSnFieldDisplay } from "./field-displays/device-sn-field-display";
export { UserPinFieldDisplay } from "./field-displays/user-pin-field-display";
export { TimestampFieldDisplay } from "./field-displays/timestamp-field-display";
export { StatusFieldDisplay } from "./field-displays/status-field-display";
export { DirectionFieldDisplay } from "./field-displays/direction-field-display";

// ── Hooks ──────────────────────────────────────────────────────────────────
export {
  useCellClickHandler,
  useTableInstanceId,
  useTableSort,
  useTableFilter,
  useTableRowSelection,
  useColumnDefinitions,
  useSchemaColumns,
} from "./hooks";

// ── Components ─────────────────────────────────────────────────────────────
export {
  DataTableContainer,
  DataTableFooter,
  DataTableRow,
  createCellRenderer,
} from "./components";

// ── Schema Mapper ──────────────────────────────────────────────────────────
export {
  mapSchemaFieldToFieldType,
  columnMetaToDefinition,
  getPresentationOverride,
} from "./schema-mapper";

// ── Column Definitions ─────────────────────────────────────────────────────
export { createPunchColumns } from "./column-definitions/punch-columns";
export { createDeviceColumns } from "./column-definitions/device-columns";
export { createUserColumns } from "./column-definitions/user-columns";
export { createApiKeyColumns } from "./column-definitions/api-key-columns";
export { createAuditColumns } from "./column-definitions/audit-columns";
export { createEmployeeColumns } from "./column-definitions/employee-columns";
