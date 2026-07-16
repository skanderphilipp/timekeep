import type { FieldDefinition, FieldMetadata, TimestampFieldMetadata } from "../types";

/**
 * Type guard: narrows a FieldDefinition to TimestampFieldMetadata.
 */
export function isFieldTimestamp(
  def: FieldDefinition<FieldMetadata>,
): def is FieldDefinition<TimestampFieldMetadata> {
  return def.type === "timestamp";
}
