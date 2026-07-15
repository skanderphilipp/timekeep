import { atom } from "jotai";
import { createState, createSelector } from "@/infrastructure/state/jotai";
import { STORAGE_KEYS } from "@/lib/constants";
import type { UserProfile } from "@/lib/api";
import { roleSatisfies } from "@/infrastructure/navigation/roles";

/**
 * Authentication state management via Jotai atoms.
 *
 * - `authTokenState` — persisted JWT token. Writing `null` clears the session.
 * - `isAuthenticatedSelector` — derived: `true` when a token is present.
 * - `logoutAtom` — write-only convenience atom that clears the token
 *   AND the cached user profile.
 * - `currentUserState` — the current user's profile (set on login or via fetchMe).
 * - Derived role atoms: `currentUserRoleSelector`, `isAdminSelector`, `isOperatorSelector`,
 *   `isViewerSelector`.
 * - `hasPermissionAtom` — factory that creates an atom to check a single permission.
 *
 * Role hierarchy is delegated to `infrastructure/navigation/roles.ts`
 * (single source of truth, framework-agnostic).
 *
 * Token presence alone determines authentication. Expiry is enforced
 * server-side (401 → auto-logout via the API client interceptor).
 */

/** Persisted JWT token. Synced to localStorage via the Jotai state layer. */
export const authTokenState = createState<string | null>({
  key: STORAGE_KEYS.auth,
  defaultValue: null,
  localStorage: true,
});

/** Derived: whether the user currently holds a token (i.e. is "logged in"). */
export const isAuthenticatedSelector = createSelector({
  key: "isAuthenticated",
  get: ({ get }) => get(authTokenState) !== null,
});

/** The current user's profile. Populated on login or via the fetchMe() API call. */
export const currentUserState = createState<UserProfile | null>({
  key: "currentUser",
  defaultValue: null,
});

/** Derived: the current user's role string (e.g. "admin", "operator"). */
export const currentUserRoleSelector = createSelector({
  key: "currentUserRole",
  get: ({ get }) => get(currentUserState)?.role ?? null,
});

/** Derived: `true` when the current user has the admin role. */
export const isAdminSelector = createSelector({
  key: "isAdmin",
  get: ({ get }) => {
    const user = get(currentUserState);
    return user !== null && roleSatisfies(user.role, "admin");
  },
});

/** Derived: `true` when the current user has at least the operator role. */
export const isOperatorSelector = createSelector({
  key: "isOperator",
  get: ({ get }) => {
    const user = get(currentUserState);
    return user !== null && roleSatisfies(user.role, "operator");
  },
});

/** Derived: `true` when the current user has at least the viewer role. */
export const isViewerSelector = createSelector({
  key: "isViewer",
  get: ({ get }) => {
    const user = get(currentUserState);
    return user !== null && roleSatisfies(user.role, "viewer");
  },
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
    const user = get(currentUserState.atom);
    if (!user) return false;
    return user.permissions.split(/\s+/).includes(permission);
  });
}

/** Write-only atom that clears the token AND cached user profile (logs out). */
export const logoutAtom = atom(null, (_get, set) => {
  set(authTokenState.atom, null);
  set(currentUserState.atom, null);
});


