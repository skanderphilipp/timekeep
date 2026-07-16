/**
 * Schema → FieldType Mapper
 *
 * Maps backend ColumnMeta (field name + value_type + facet_kind) to the
 * data-renderer's generic FieldType discriminated union.
 *
 * The backend schema now provides `facet_kind`:
 *   - `"enum"` → FieldType "status" or "enum"
 *   - `"reference"` → FieldType "reference" with entity metadata from presentation overrides
 *
 * For non-facet fields, the value_type determines the display type:
 *   - `"int"` → "number"
 *   - `"text"` → "text" (with field-name-based refinements for timestamps)
 *
 * This mapper is TEMPORARY until the backend schema carries a dedicated
 * `display_type` field (e.g., "timestamp", "reference", "status").
 *
 * TODO(ENTERPRISE): Backend ColumnMeta should carry `display_type` directly.
 * Phase: Schema v2
 * Impact: Field name heuristics are brittle. New fields default to "text".
 * Fix: Add `display_type: FieldType` to `ColumnMeta` in the Rust backend,
 *       populate it from entity schema config, remove this mapper entirely.
 */

import type { FieldType, ReferenceFieldMetadata } from "./types";
import type { ColumnMeta, ColumnPresentation } from "@/types/metadata";
import { PRESENTATION_OVERRIDES, REFERENCE_CONFIG } from "@/types/metadata";
import type { ColumnDefinition, FieldMetadata } from "./types";

/**
 * Map a schema column to a data-renderer FieldType.
 *
 * Precedence:
 *   1. `PRESENTATION_OVERRIDES.displayType` (explicit override)
 *   2. Backend `facet_kind` → "status" / "reference"
 *   3. Field name heuristics (timestamp fields) — temporary fallback
 *   4. Backend `value_type` → "text" / "number"
 */
export function mapSchemaFieldToFieldType(
  field: string,
  valueType: ColumnMeta["value_type"],
  entity: string,
): FieldType {
  // Entity-level type override (from PRESENTATION_OVERRIDES)
  const overrides = PRESENTATION_OVERRIDES[entity]?.[field];
  if (overrides?.displayType) return overrides.displayType;

  // Check reference config
  const refConfig = REFERENCE_CONFIG[entity]?.[field];
  if (refConfig) return "reference";

  // Temporal fields (heuristic — to be replaced by backend display_type)
  switch (field) {
    case "timestamp":
    case "created_at":
    case "updated_at":
    case "last_seen_at":
      return "timestamp";
  }

  // Value type fallback
  return valueType === "int" ? "number" : "text";
}

/**
 * Build reference metadata from schema config.
 * Returns undefined if the field is not a reference.
 */
function buildReferenceMetadata(
  entity: string,
  field: string,
): ReferenceFieldMetadata | undefined {
  const refConfig = REFERENCE_CONFIG[entity]?.[field];
  if (!refConfig) return undefined;

  return {
    fieldName: field,
    isSortable: false,
    referenceEntity: refConfig.referenceEntity,
    referenceIdField: refConfig.referenceIdField ?? field,
    displayField: refConfig.displayField,
  };
}

/**
 * Convert a single ColumnMeta (from schema) into a data-renderer ColumnDefinition.
 */
export function columnMetaToDefinition(
  col: ColumnMeta,
  entity: string,
  overrides?: ColumnPresentation,
): ColumnDefinition<FieldMetadata> {
  const fieldType = mapSchemaFieldToFieldType(col.field, col.value_type, entity);

  // Reference fields get special metadata
  const refMetadata = fieldType === "reference"
    ? buildReferenceMetadata(entity, col.field)
    : undefined;

  return {
    id: col.field,
    header: col.label,
    fieldId: col.field,
    label: col.label,
    type: fieldType,
    metadata: refMetadata ?? ({
      fieldName: col.field,
      isSortable: col.sortable,
    } as FieldMetadata),
    isVisible: true,
    width: overrides?.width,
    align: overrides?.align,
    cellClassName: overrides?.cellClassName,
  };
}

/**
 * Get presentation overrides for a given field in a given entity.
 */
export function getPresentationOverride(
  entity: string,
  field: string,
): ColumnPresentation | undefined {
  const entityOverrides = PRESENTATION_OVERRIDES[entity];
  if (!entityOverrides) return undefined;
  return entityOverrides[field];
}
