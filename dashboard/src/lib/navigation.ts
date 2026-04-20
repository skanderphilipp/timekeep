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

/** Navigate to the punch list pre-filtered for a device. */
export function punchesForDevice(deviceSn: string): string {
  return `/punches?device_sn=${encodeURIComponent(deviceSn)}`;
}

/** Navigate to the punch list pre-filtered for a user. */
export function punchesForUser(userPin: string): string {
  return `/punches?user_pin=${encodeURIComponent(userPin)}`;
}
