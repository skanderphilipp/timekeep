import type { FieldDefinition, FieldMetadata, TextFieldMetadata } from "../types";

/**
 * Type guard: narrows a FieldDefinition to TextFieldMetadata.
 */
export function isFieldText(
  def: FieldDefinition<FieldMetadata>,
): def is FieldDefinition<TextFieldMetadata> {
  return def.type === "text";
}
