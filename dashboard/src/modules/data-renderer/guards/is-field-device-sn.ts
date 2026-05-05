import type {
  FieldDefinition,
  FieldMetadata,
  DeviceSnFieldMetadata,
} from "../types";

/**
 * Type guard: returns `true` if the field is a device serial number field.
 *
 * Device SN cells should render as clickable chips that open
 * the device detail panel.
 */
export function isFieldDeviceSn(
  field: FieldDefinition<FieldMetadata>,
): field is FieldDefinition<DeviceSnFieldMetadata> {
  return field.type === "device_sn";
}
