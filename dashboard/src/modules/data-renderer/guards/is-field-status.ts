import type { FieldDefinition, FieldMetadata, StatusFieldMetadata } from "../types";

/**
 * Type guard: returns `true` if the field is a status field.
 *
 * Status fields render as colored Tags (check_in → green, check_out → red, etc.).
 */
export function isFieldStatus(
  field: FieldDefinition<FieldMetadata>,
): field is FieldDefinition<StatusFieldMetadata> {
  return field.type === "status";
}
