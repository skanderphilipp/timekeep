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
 */
export function mapSchemaFieldToFieldType(field: string, _valueType: ColumnMeta["value_type"]): FieldType {
	switch (field) {
		// Temporal
		case "timestamp":
		case "created_at":
		case "last_seen_at":
			return "timestamp";
		// Reference / link fields
		case "device_sn":
			return "device_sn";
		case "user_pin":
			return "user_pin";
		case "employee_name":
			return "employee_name";
		// Status-like enums
		case "status":
		case "connection_status":
		case "active":
			return "status";
		// Verification
		case "verify_mode":
			return "verify_method";
		// Direction (check_in / check_out)
		case "direction":
			return "direction";
		default:
			return "text";
	}
}

/**
 * Convert a single ColumnMeta (from schema) into a data-renderer ColumnDefinition.
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
 */
export function getPresentationOverride(
	entity: string,
	field: string,
): ColumnPresentation | undefined {
	const entityOverrides = PRESENTATION_OVERRIDES[entity];
	if (!entityOverrides) return undefined;
	return entityOverrides[field];
}
