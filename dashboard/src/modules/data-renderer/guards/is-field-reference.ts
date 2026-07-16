import type { FieldDefinition, FieldMetadata, ReferenceFieldMetadata } from "../types";

/**
 * Type guard: narrows a FieldDefinition to ReferenceFieldMetadata.
 */
export function isFieldReference(
  def: FieldDefinition<FieldMetadata>,
): def is FieldDefinition<ReferenceFieldMetadata> {
  return def.type === "reference";
}
