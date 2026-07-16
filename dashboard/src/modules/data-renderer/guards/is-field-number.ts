import type { FieldDefinition, FieldMetadata, NumberFieldMetadata } from "../types";

/**
 * Type guard: narrows a FieldDefinition to NumberFieldMetadata.
 */
export function isFieldNumber(
  def: FieldDefinition<FieldMetadata>,
): def is FieldDefinition<NumberFieldMetadata> {
  return def.type === "number";
}
