import type { DeviceActivityEvent } from "../components/device-detail-view";

/**
 * Pure functions for device detail logic — extracted for testability.
 *
 * These functions have zero React dependencies and can be unit-tested
 * without component rendering or DOM interaction.
 */

/** Map API event_type string to DeviceActivityEvent kind. */
export function mapEventKind(eventType: string | undefined | null): DeviceActivityEvent["kind"] {
  if (eventType == null) return "provision";
  if (eventType.includes("offline")) return "offline";
  if (eventType.includes("online")) return "online";
  if (eventType.includes("sync") && eventType.includes("fail")) return "warning";
  if (eventType.includes("sync")) return "sync";
  if (eventType.includes("config") || eventType.includes("settings")) return "config";
  if (eventType.includes("operation_log")) return "sync";
  if (eventType.includes("user_synced")) return "sync";
  if (eventType.includes("device_command")) return "config";
  return "provision";
}

/**
 * Calculate storage percentage from record count and capacity.
 * Returns a value between 0–100, clamped.
 */
export function calcStoragePct(recordCount: number, recordCapacity: number): number {
  if (recordCapacity <= 0) return 0;
  return Math.min(100, (recordCount / recordCapacity) * 100);
}

/**
 * Determine the progress bar variant based on storage percentage.
 * - ≥80% → danger
 * - ≥60% → warning
 * - <60% → success
 */
export function storageBarVariant(pct: number): "success" | "warning" | "danger" {
  if (pct >= 80) return "danger";
  if (pct >= 60) return "warning";
  return "success";
}

/**
 * Derive user usage percentage (capped at 100).
 */
export function calcUserPct(userCount: number, userCapacity: number): number {
  if (userCapacity <= 0) return 0;
  return (userCount / userCapacity) * 100;
}
