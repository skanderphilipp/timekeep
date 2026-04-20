/**
 * UI mappings for device statuses — thin wrapper over the shared catalog.
 *
 * The canonical status definitions come from `@shared/device-statuses`.
 * Variant and dotColor are presentation concerns, kept in the dashboard layer.
 */

import { DEVICE_STATUSES, type DeviceStatusValue } from "@shared/device-statuses";

export type StatusBadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";
export type StatusDotColor = "online" | "offline" | "warning";

type DeviceStatusUI = {
  variant: StatusBadgeVariant;
  dotColor: StatusDotColor;
};

/** UI variant mapping for each device status. */
const DEVICE_STATUS_UI: Record<DeviceStatusValue, DeviceStatusUI> = {
  online: { variant: "success", dotColor: "online" },
  offline: { variant: "neutral", dotColor: "offline" },
  syncing: { variant: "info", dotColor: "online" },
  error: { variant: "danger", dotColor: "warning" },
  provisioning: { variant: "info", dotColor: "online" },
  decommissioned: { variant: "neutral", dotColor: "offline" },
};

/** Get the UI variant config for a device status value. */
export function getDeviceStatusUI(value: string): DeviceStatusUI {
  return DEVICE_STATUS_UI[value as DeviceStatusValue] ?? DEVICE_STATUS_UI.offline;
}

export { DEVICE_STATUSES, type DeviceStatusValue };
