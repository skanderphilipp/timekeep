/**
 * Permission catalog — single source of truth for the entire system.
 *
 * Both the Rust backend (`crates/timekeep-core/src/model/iam.rs`)
 * and the frontend (`dashboard/src/lib/permissions.ts`) derive their
 * permission model from this file.
 *
 * ## Bit position contract
 *
 * Entry order is FROZEN. Index 0 = PermissionSet bit 0, index 1 = bit 1, etc.
 * **Append only — never reorder or delete entries.**
 *
 * To add a permission:
 * 1. Append a new entry at the end of `ALL_PERMISSIONS`
 * 2. Add the corresponding `const MY_PERM = 1 << N` in `iam.rs` bitflags
 * 3. Run `pnpm generate-shared` to update `permissions.json` for Rust
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical permission value strings — use this for type-safe unions. */
export type PermissionValue =
  | "read:punches"
  | "write:punches"
  | "read:devices"
  | "write:devices"
  | "manage:device_users"
  | "manage:device_commands"
  | "manage:dashboard_users"
  | "manage:api_keys"
  | "manage:endpoints"
  | "manage:settings"
  | "export:data"
  | "view:audit";

/** A single permission definition. */
export type Permission = {
  /** Canonical token (matches `PermissionValue`). */
  value: PermissionValue;
  /** Human-readable label for dropdowns and badges. */
  label: string;
  /** Tooltip / helper text shown in the UI. */
  description: string;
  /** Logical grouping for the permission catalog UI. */
  scope: "Punches" | "Devices" | "Admin" | "Data";
};

/**
 * All available permissions in the system (12 total).
 *
 * Order MUST match the `PermissionSet` bit positions in
 * `crates/timekeep-core/src/model/iam.rs`.
 */
export const ALL_PERMISSIONS = [
  // ── Punches ──
  {
    value: "read:punches",
    label: "Read Punches",
    description: "View attendance punch records and dashboard summaries.",
    scope: "Punches",
  },
  {
    value: "write:punches",
    label: "Write Punches",
    description: "Create or correct punch records (manual override).",
    scope: "Punches",
  },

  // ── Devices ──
  {
    value: "read:devices",
    label: "Read Devices",
    description: "View device configuration and connection status.",
    scope: "Devices",
  },
  {
    value: "write:devices",
    label: "Write Devices",
    description: "Add, update, or remove devices from the registry.",
    scope: "Devices",
  },
  {
    value: "manage:device_users",
    label: "Manage Device Users",
    description: "Enroll or delete users on biometric scanners.",
    scope: "Devices",
  },
  {
    value: "manage:device_commands",
    label: "Manage Device Commands",
    description: "Enqueue commands on devices (reboot, clear attendance, etc.).",
    scope: "Devices",
  },

  // ── Dashboard Administration ──
  {
    value: "manage:dashboard_users",
    label: "Manage Dashboard Users",
    description: "Create, update, or delete dashboard operators.",
    scope: "Admin",
  },
  {
    value: "manage:api_keys",
    label: "Manage API Keys",
    description: "Create or revoke API keys for integration partners.",
    scope: "Admin",
  },
  {
    value: "manage:endpoints",
    label: "Manage Endpoints",
    description: "Create, edit, or delete integration endpoints.",
    scope: "Admin",
  },
  {
    value: "manage:settings",
    label: "Manage Settings",
    description: "Modify system-wide settings (poll interval, auto-discover).",
    scope: "Admin",
  },

  // ── Data ──
  {
    value: "export:data",
    label: "Export Data",
    description: "Download punch data as CSV or XLSX files.",
    scope: "Data",
  },
  {
    value: "view:audit",
    label: "View Audit",
    description: "Read the audit log of system actions.",
    scope: "Data",
  },
] as const satisfies readonly Permission[];

/** Permission value → Permission lookup (built once). */
export const PERMISSION_MAP = new Map<PermissionValue, Permission>(
  ALL_PERMISSIONS.map((p) => [p.value, p]),
);

/** Get a permission definition by its token value. */
export function getPermission(value: string): Permission | undefined {
  return PERMISSION_MAP.get(value as PermissionValue);
}

/** Parse a space-separated permissions string into an array of values. */
export function parsePermissionsString(raw: string): PermissionValue[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s): s is PermissionValue => PERMISSION_MAP.has(s as PermissionValue));
}
