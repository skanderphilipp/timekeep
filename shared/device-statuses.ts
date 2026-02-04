/**
 * Device connection / lifecycle statuses.
 *
 * Mirrors `DeviceStatus` enum in `crates/timekeep-core/src/model/device.rs`.
 * Serialized as snake_case in API responses.
 *
 * Note: the frontend previously used "connected"/"disconnected"/"unknown"
 * informally. The canonical values below are the Rust source of truth.
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical device status value strings. */
export type DeviceStatusValue =
  | "online"
  | "offline"
  | "syncing"
  | "error"
  | "provisioning"
  | "decommissioned";

/** A device status definition. */
export type DeviceStatus = {
  /** Wire value (snake_case). */
  value: DeviceStatusValue;
  /** Human-readable label for badges and status displays. */
  label: string;
  /** Whether this status means the device is actively usable. */
  isOperational: boolean;
  /** Whether this status represents a problem requiring attention. */
  isProblem: boolean;
};

/**
 * All device lifecycle statuses in order of severity (operational first).
 */
export const DEVICE_STATUSES = [
  { value: "online",         label: "Online",         isOperational: true,  isProblem: false },
  { value: "syncing",        label: "Syncing",        isOperational: true,  isProblem: false },
  { value: "provisioning",   label: "Provisioning",   isOperational: false, isProblem: false },
  { value: "offline",        label: "Offline",        isOperational: false, isProblem: true  },
  { value: "error",          label: "Error",          isOperational: false, isProblem: true  },
  { value: "decommissioned", label: "Decommissioned", isOperational: false, isProblem: false },
] as const satisfies readonly DeviceStatus[];

/** Device status value → definition lookup. */
export const DEVICE_STATUS_MAP = new Map<DeviceStatusValue, DeviceStatus>(
  DEVICE_STATUSES.map((s) => [s.value, s]),
);

/** Get a device status definition by its value string. */
export function getDeviceStatus(value: string): DeviceStatus | undefined {
  return DEVICE_STATUS_MAP.get(value as DeviceStatusValue);
}
