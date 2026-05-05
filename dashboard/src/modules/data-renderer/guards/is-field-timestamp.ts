import type {
  FieldDefinition,
  FieldMetadata,
  TimestampFieldMetadata,
} from "../types";

/**
 * Type guard: returns `true` if the field is a timestamp field.
 *
 * Timestamps are Unix seconds that should be formatted as dates/times.
 */
export function isFieldTimestamp(
  field: FieldDefinition<FieldMetadata>,
): field is FieldDefinition<TimestampFieldMetadata> {
  return field.type === "timestamp";
}
