import type { FieldDefinition, FieldMetadata, EmployeeNameFieldMetadata } from "../types";

/**
 * Type guard: returns `true` if the field is an employee name field.
 *
 * Employee name cells should render as clickable chips that open
 * the user detail panel using the row's `user_pin` for navigation.
 */
export function isFieldEmployeeName(
  field: FieldDefinition<FieldMetadata>,
): field is FieldDefinition<EmployeeNameFieldMetadata> {
  return field.type === "employee_name";
}
