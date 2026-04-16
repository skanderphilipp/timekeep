import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { LS_AUTH } from "@/lib/constants";
import type { UserProfile } from "@/lib/api";
import { roleSatisfies } from "@/infrastructure/navigation/roles";

/**
 * Authentication state management via Jotai atoms.
 *
 * - `authTokenAtom` — persisted JWT token. Writing `null` clears the session.
 * - `isAuthenticatedAtom` — derived: `true` when a token is present.
 * - `logoutAtom` — write-only convenience atom that clears the token
 *   AND the cached user profile.
 * - `currentUserAtom` — the current user's profile (set on login or via fetchMe).
 * - Derived role atoms: `currentUserRoleAtom`, `isAdminAtom`, `isOperatorAtom`,
 *   `isViewerAtom`.
 * - `hasPermissionAtom` — factory that creates an atom to check a single permission.
 *
 * Role hierarchy is delegated to `infrastructure/navigation/roles.ts`
 * (single source of truth, framework-agnostic).
 *
 * Token presence alone determines authentication. Expiry is enforced
 * server-side (401 → auto-logout via the API client interceptor).
 */

/** Persisted JWT token. Synced to localStorage via atomWithStorage. */
export const authTokenAtom = atomWithStorage<string | null>(LS_AUTH, null);

/** Derived: whether the user currently holds a token (i.e. is "logged in"). */
export const isAuthenticatedAtom = atom((get) => get(authTokenAtom) !== null);

/** The current user's profile. Populated on login or via the fetchMe() API call. */
export const currentUserAtom = atom<UserProfile | null>(null);

/** Derived: the current user's role string (e.g. "admin", "operator"). */
export const currentUserRoleAtom = atom((get) => get(currentUserAtom)?.role ?? null);

/** Derived: `true` when the current user has the admin role. */
export const isAdminAtom = atom((get) => {
  const user = get(currentUserAtom);
  return user !== null && roleSatisfies(user.role, "admin");
});

/** Derived: `true` when the current user has at least the operator role. */
export const isOperatorAtom = atom((get) => {
  const user = get(currentUserAtom);
  return user !== null && roleSatisfies(user.role, "operator");
});

/** Derived: `true` when the current user has at least the viewer role. */
export const isViewerAtom = atom((get) => {
  const user = get(currentUserAtom);
  return user !== null && roleSatisfies(user.role, "viewer");
});

/**
 * Factory: creates an atom that checks whether the current user has
 * the given permission scope.
 *
 * @example
 * ```ts
 * const canWritePunches = hasPermissionAtom("write:punches");
 * // useAtomValue(canWritePunches) → boolean
 * ```
 */
export function hasPermissionAtom(permission: string) {
  return atom((get) => {
    const user = get(currentUserAtom);
    if (!user) return false;
    return user.permissions.split(/\s+/).includes(permission);
  });
}

/** Write-only atom that clears the token AND cached user profile (logs out). */
export const logoutAtom = atom(null, (_get, set) => {
  set(authTokenAtom, null);
  set(currentUserAtom, null);
});
