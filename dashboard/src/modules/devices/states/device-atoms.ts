import { createState } from "@/infrastructure/state/jotai";
import type { DeviceStatusValue } from "@shared/device-statuses";

/**
 * Device module state atoms.
 */

/** Currently selected device serial number. `null` = no device selected. */
export const selectedDeviceSnState = createState<string | null>({
  key: "selectedDeviceSn",
  defaultValue: null,
});

/** Current search term for filtering devices. */
export const deviceSearchState = createState<string>({
  key: "deviceSearch",
  defaultValue: "",
});

/** Active connection status filter for device list. */
export const deviceStatusFilterState = createState<DeviceStatusValue | null>({
  key: "deviceStatusFilter",
  defaultValue: null,
});

/** Active vendor filter for device list. */
export const deviceVendorFilterState = createState<string | null>({
  key: "deviceVendorFilter",
  defaultValue: null,
});
