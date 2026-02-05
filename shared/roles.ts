/**
 * Role hierarchy — single source of truth for the entire system.
 *
 * Both the Rust backend (`crates/timekeep-core/src/model/iam.rs`)
 * and this frontend derive their role model from here.
 *
 * Framework-agnostic: no React, no Jotai, no router imports.
 */

/** Role strings as a const union — mirrors the Rust backend's Role enum. */
export type Role = "admin" | "operator" | "viewer";

/** All valid roles in hierarchy order (highest first). */
export const ROLES = ["admin", "operator", "viewer"] as const satisfies readonly Role[];

/** Numeric levels for comparison. Higher = more privileged. */
const ROLE_LEVEL: Record<Role, number> = {
  admin: 3,
  operator: 2,
  viewer: 1,
};

/**
 * Returns `true` if `userRole` meets or exceeds `minimum`.
 *
 * @example
 * ```ts
 * roleSatisfies("operator", "viewer")   // true  — operator can do anything viewer can
 * roleSatisfies("viewer", "operator")   // false — viewer cannot do operator things
 * ```
 */
export function roleSatisfies(userRole: string, minimum: Role): boolean {
  const userLevel = ROLE_LEVEL[userRole as Role] ?? 0;
  const requiredLevel = ROLE_LEVEL[minimum] ?? 0;
  return userLevel >= requiredLevel;
}

/** Returns the numeric level of a role string, or 0 if unrecognized. */
export function roleLevel(role: string): number {
  return ROLE_LEVEL[role as Role] ?? 0;
}
