/**
 * Navigation helpers — type-safe route construction.
 *
 * Every route is defined once in `shared/paths.ts`. This module re-exports
 * for convenience and adds framework-specific navigation helpers.
 *
 * Import: import { AppRoute, punchesForDevice, punchesForUser } from "@/lib/navigation";
 */

// Re-export the canonical paths from shared (framework-agnostic)
export { AppRoute } from "@shared/paths";

// ── Navigation helpers (for programmatic use) ─────────────────────────────

/** Navigate to the attendance list pre-filtered for a device. */
export function attendanceForDevice(deviceSn: string): string {
  return `/attendance?device_sn=${encodeURIComponent(deviceSn)}`;
}

/** Navigate to the attendance list pre-filtered for a user. */
export function attendanceForUser(userPin: string): string {
  return `/attendance?user_pin=${encodeURIComponent(userPin)}`;
}
