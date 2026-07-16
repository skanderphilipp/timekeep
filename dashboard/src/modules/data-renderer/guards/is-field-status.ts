import type { FieldDefinition, FieldMetadata, StatusFieldMetadata } from "../types";

/**
 * Type guard: narrows a FieldDefinition to StatusFieldMetadata.
 */
export function isFieldStatus(
  def: FieldDefinition<FieldMetadata>,
): def is FieldDefinition<StatusFieldMetadata> {
  return def.type === "status";
}
