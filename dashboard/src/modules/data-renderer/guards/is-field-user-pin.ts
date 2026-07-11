import type { FieldDefinition, FieldMetadata, UserPinFieldMetadata } from "../types";

/**
 * Type guard: returns `true` if the field is a user PIN field.
 *
 * User PIN cells should render as clickable chips that open
 * the user detail panel.
 */
export function isFieldUserPin(
  field: FieldDefinition<FieldMetadata>,
): field is FieldDefinition<UserPinFieldMetadata> {
  return field.type === "user_pin";
}
