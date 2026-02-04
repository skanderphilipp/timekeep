/**
 * Device lifecycle event types — events recorded in the device timeline.
 *
 * Mirrors `DeviceEventType` enum in `crates/timekeep-core/src/model/device_event.rs`.
 * Serialized keys match the Rust `key()` method (snake_case).
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical device event type key strings. */
export type DeviceEventTypeKey =
  | "came_online"
  | "went_offline"
  | "sync_started"
  | "sync_completed"
  | "sync_failed"
  | "storage_warning"
  | "config_changed"
  | "provisioning_started"
  | "provisioning_completed"
  | "decommissioned"
  | "firmware_updated";

/** A device event type definition. */
export type DeviceEventType = {
  /** Key string for API filtering and storage. */
  key: DeviceEventTypeKey;
  /** Human-readable label for the timeline UI. */
  label: string;
  /** Whether this event represents a problem requiring attention. */
  isProblem: boolean;
};

/**
 * All device event types.
 * Order matches the Rust enum definition.
 */
export const DEVICE_EVENT_TYPES = [
  { key: "came_online",            label: "Came online",            isProblem: false },
  { key: "went_offline",           label: "Went offline",           isProblem: true  },
  { key: "sync_started",           label: "Sync started",           isProblem: false },
  { key: "sync_completed",         label: "Sync completed",         isProblem: false },
  { key: "sync_failed",            label: "Sync failed",            isProblem: true  },
  { key: "storage_warning",        label: "Storage warning",        isProblem: true  },
  { key: "config_changed",         label: "Config changed",         isProblem: false },
  { key: "provisioning_started",   label: "Provisioning started",   isProblem: false },
  { key: "provisioning_completed", label: "Provisioning completed", isProblem: false },
  { key: "decommissioned",         label: "Decommissioned",         isProblem: false },
  { key: "firmware_updated",       label: "Firmware updated",       isProblem: false },
] as const satisfies readonly DeviceEventType[];

/** Event key → definition lookup. */
export const DEVICE_EVENT_TYPE_MAP = new Map<DeviceEventTypeKey, DeviceEventType>(
  DEVICE_EVENT_TYPES.map((e) => [e.key, e]),
);

/** Get a device event type definition by its key string. */
export function getDeviceEventType(key: string): DeviceEventType | undefined {
  return DEVICE_EVENT_TYPE_MAP.get(key as DeviceEventTypeKey);
}

/** Problem event keys (for alert detection). */
export const PROBLEM_EVENT_KEYS = new Set(
  DEVICE_EVENT_TYPES.filter((e) => e.isProblem).map((e) => e.key),
);
