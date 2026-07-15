import { useMemo } from "react";

import { authTokenState } from "@/infrastructure/state";
import { useStateValue } from "@/infrastructure/state/jotai";
import { decodeToken, roleSatisfies, type Role, type JwtClaims } from "@/lib/jwt";

/**
 * Current user hook — extracts claims from the JWT.
 *
 * Unlike `isAuthenticatedSelector` (boolean), this hook provides the full
 * user context: username, role, and permissions. Components use this
 * to gate UI elements based on role.
 *
 * @example
 * ```tsx
 * const user = useCurrentUser();
 * if (user?.role === "admin") { ... }
 * ```
 */
export function useCurrentUser(): JwtClaims | null {
  const token = useStateValue(authTokenState);
  return useMemo(() => decodeToken(token), [token]);
}

/**
 * Check whether the current user has at least the given role.
 *
 * @example
 * ```tsx
 * const isAdmin = useHasRole("admin");
 * {isAdmin && <AdminPanel />}
 * ```
 */
export function useHasRole(requiredRole: Role): boolean {
  const user = useCurrentUser();
  if (!user) return false;
  return roleSatisfies(user.role, requiredRole);
}

/**
 * Check whether the current user has a specific permission scope.
 *
 * @example
 * ```tsx
 * const canWritePunches = useHasPermission("write:punches");
 * ```
 */
export function useHasPermission(permission: string): boolean {
  const user = useCurrentUser();
  if (!user) return false;
  return user.permissions.split(/\s+/).includes(permission);
}
