import type { FieldDefinition, FieldMetadata, TextFieldMetadata } from "../types";

/**
 * Type guard: returns `true` if the field is a plain text field.
 */
export function isFieldText(
  field: FieldDefinition<FieldMetadata>,
): field is FieldDefinition<TextFieldMetadata> {
  return field.type === "text";
}
