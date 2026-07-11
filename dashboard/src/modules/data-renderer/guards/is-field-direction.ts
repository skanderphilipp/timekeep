import type { FieldDefinition, FieldMetadata, DirectionFieldMetadata } from "../types";

/**
 * Type guard: returns `true` if the field is a direction field (IN/OUT).
 *
 * Direction fields render as colored Tags (IN → green, OUT → red).
 */
export function isFieldDirection(
  field: FieldDefinition<FieldMetadata>,
): field is FieldDefinition<DirectionFieldMetadata> {
  return field.type === "direction";
}
