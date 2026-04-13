/**
 * Role hierarchy — thin re-export from `shared/roles.ts`.
 *
 * The canonical definitions live in `shared/` so both the Rust backend
 * and this frontend share the same role model.
 */

export { type Role, ROLES, roleSatisfies, roleLevel } from "@shared/roles";
