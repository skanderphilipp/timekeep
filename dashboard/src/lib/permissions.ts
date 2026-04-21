/**
 * Permission utilities — thin re-export from the canonical `shared/permissions.ts`.
 *
 * The single source of truth is `shared/permissions.ts`. Both the Rust backend
 * (`crates/timekeep-core/src/model/iam.rs` — via auto-generated `permissions.json`)
 * and this module derive their permission model from that file.
 */

export {
  ALL_PERMISSIONS,
  PERMISSION_MAP,
  getPermission,
  parsePermissionsString,
  type Permission,
  type PermissionValue,
} from "@shared/permissions";
