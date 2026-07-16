import type { FieldDefinition, FieldMetadata, EnumFieldMetadata } from "../types";

/**
 * Type guard: narrows a FieldDefinition to EnumFieldMetadata.
 */
export function isFieldEnum(
  def: FieldDefinition<FieldMetadata>,
): def is FieldDefinition<EnumFieldMetadata> {
  return def.type === "enum";
}
