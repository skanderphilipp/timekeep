import { createContext, useContext } from "react";
import type { FieldDefinition, FieldMetadata } from "../types";

/**
 * Field context — scoped to rendering a single field value.
 *
 * Used by `FieldDisplay` and `FieldInput` components to access
 * the field definition, value, and interaction callbacks.
 * Pattern: analogous to pulse's `FieldContext`.
 */
export type FieldContextValue = {
  /** The field definition (type + metadata). */
  fieldDefinition: FieldDefinition<FieldMetadata>;
  /** The raw value for this field from the record. */
  value: unknown;
  /** Whether this field is the record's label/identifier. */
  isLabelIdentifier: boolean;
  /** Called when a clickable field (chip) is clicked. */
  onFieldClick: () => void;
  /** Whether the field is in edit mode. */
  isEditMode: boolean;
  /** For link/chip fields: the entity ID used for navigation (e.g., user PIN). */
  entityId?: string;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) {
    throw new Error(
      "useFieldContext must be used within a FieldContextProvider",
    );
  }
  return ctx;
}

export { FieldContext };
