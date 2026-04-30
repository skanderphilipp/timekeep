import type { ColumnDefinition } from "../types";
import type { MessageDescriptor } from "@lingui/core";
import type {
  DeviceSnFieldMetadata,
  TextFieldMetadata,
} from "../types";
import { msg } from "@lingui/core/macro";

type T = (descriptor: MessageDescriptor) => string;

/**
 * Device column definitions — for the device list table.
 *
 * Columns:
 * - device_sn (label identifier → clickable Chip)
 * - alias (device name/label)
 * - ip_address (plain text)
 * - port (plain text)
 */
export function createDeviceColumns(_: T): ColumnDefinition[] {
  return [
    {
      id: "device_sn",
      header: _(msg`Serial Number`),
      fieldId: "device_sn",
      label: _(msg`Serial Number`),
      type: "device_sn",
      metadata: {
        fieldName: "device_sn",
        isSortable: true,
      } as DeviceSnFieldMetadata,
      isVisible: true,
      isLabelIdentifier: true,
      width: "180px",
    },
    {
      id: "alias",
      header: _(msg`Name`),
      fieldId: "alias",
      label: _(msg`Name`),
      type: "text",
      metadata: {
        fieldName: "alias",
        isSortable: true,
      } as TextFieldMetadata,
      isVisible: true,
      width: "150px",
    },
    {
      id: "ip_address",
      header: _(msg`IP Address`),
      fieldId: "ip_address",
      label: _(msg`IP Address`),
      type: "text",
      metadata: {
        fieldName: "ip_address",
        isSortable: false,
      } as TextFieldMetadata,
      isVisible: true,
      width: "140px",
    },
    {
      id: "port",
      header: _(msg`Port`),
      fieldId: "port",
      label: _(msg`Port`),
      type: "text",
      metadata: {
        fieldName: "port",
        isSortable: false,
      } as TextFieldMetadata,
      isVisible: true,
      width: "80px",
    },
  ];
}
