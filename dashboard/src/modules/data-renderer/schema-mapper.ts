/**
 * Schema → FieldType Mapper
 *
 * Maps backend ColumnMeta (field name + value_type) to the data-renderer's
 * FieldType discriminated union. This is the bridge between metadata-driven
 * columns and the FieldDisplay dispatch system.
 *
 * The field name is the primary discriminant because backend labels carry
 * semantic meaning (e.g., "timestamp" is always a timestamp, "device_sn"
 * is always a device reference). For unknown fields, value_type provides
 * a reasonable fallback.
 */

import type { FieldType } from "./types";
import type { ColumnMeta, ColumnPresentation } from "@/types/metadata";
import { PRESENTATION_OVERRIDES } from "@/types/metadata";
import type { ColumnDefinition, FieldMetadata } from "./types";

/**
 * Map a schema column's field name + value_type to a data-renderer FieldType.
 *
 * Known fields are mapped by name (semantic). Unknown fields fall back to
 * value_type: "int" → "text" (generic numeric display), "text" → "text".
 */
export function mapSchemaFieldToFieldType(field: string, _valueType: ColumnMeta["value_type"]): FieldType {
	switch (field) {
		case "timestamp":
			return "timestamp";
		case "device_sn":
			return "device_sn";
		case "user_pin":
			return "user_pin";
		case "status":
			return "status";
		case "verify_mode":
			return "verify_method";
		default:
			return "text";
	}
}

/**
 * Convert a single ColumnMeta (from schema) into a data-renderer ColumnDefinition.
 *
 * Merges backend structural metadata (sortability, type) with frontend
 * presentation overrides (width, alignment, label role).
 */
export function columnMetaToDefinition(
	col: ColumnMeta,
	overrides?: ColumnPresentation,
): ColumnDefinition<FieldMetadata> {
	const fieldType = mapSchemaFieldToFieldType(col.field, col.value_type);

	return {
		id: col.field,
		header: col.label,
		fieldId: col.field,
		label: col.label,
		type: fieldType,
		metadata: {
			fieldName: col.field,
			isSortable: col.sortable,
		} as FieldMetadata,
		isVisible: true,
		width: overrides?.width,
		align: overrides?.align,
		isLabelIdentifier: overrides?.isLabelIdentifier ?? false,
		cellClassName: overrides?.cellClassName,
	};
}

/**
 * Get presentation overrides for a given field in a given entity.
 *
 * Returns undefined if no overrides exist — callers should use defaults.
 */
export function getPresentationOverride(
	entity: string,
	field: string,
): ColumnPresentation | undefined {
	const entityOverrides = PRESENTATION_OVERRIDES[entity];
	if (!entityOverrides) return undefined;
	return entityOverrides[field];
}
