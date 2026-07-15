import { atom } from "jotai";
import type { DashboardUser } from "@/lib/api";

/**
 * User module Jotai atoms — cross-cutting UI state for user management.
 *
 * These atoms enable coordination between views:
 * - The dashboard "checked-in" list can open the user editor
 * - The side panel can show user details
 * - The form mode persists across component mounts
 *
 * TanStack Query handles server state (user list fetching, mutations).
 * These atoms handle LOCAL UI state that multiple components may need.
 */

/** Which user is currently selected (for detail view, side panel, etc.). */
export const selectedUserIdAtom = atom<string | undefined>(undefined);

/** The user currently being edited. `undefined` means no edit in progress. */
export const editingUserAtom = atom<DashboardUser | undefined>(undefined);

/** Form mode: closed, creating a new user, or editing an existing one. */
export const userFormModeAtom = atom<"closed" | "create" | "edit">("closed");

/** User pending deletion confirmation. */
export const deletingUserAtom = atom<DashboardUser | undefined>(undefined);

/** User for whom the password change dialog is open. */
export const passwordChangeUserAtom = atom<DashboardUser | undefined>(undefined);

/**
 * Derived: whether the user form dialog should be open.
 * True when formMode is 'create' or 'edit'.
 */
export const isUserFormOpenAtom = atom((get) => get(userFormModeAtom) !== "closed");

/**
 * Derived: whether the delete confirmation dialog should be open.
 */
export const isDeleteDialogOpenAtom = atom((get) => get(deletingUserAtom) !== undefined);

/**
 * Derived: whether the password change dialog should be open.
 */
export const isPasswordDialogOpenAtom = atom((get) => get(passwordChangeUserAtom) !== undefined);

/** Write-only atom: opens the create user form. */
export const openCreateUserFormAtom = atom(null, (_get, set) => {
  set(editingUserAtom, undefined);
  set(userFormModeAtom, "create");
});

/** Write-only atom: opens the edit form for a specific user. */
export const openEditUserFormAtom = atom(null, (_get, set, user: DashboardUser) => {
  set(editingUserAtom, user);
  set(userFormModeAtom, "edit");
});

/** Write-only atom: closes the form and clears editing state. */
export const closeUserFormAtom = atom(null, (_get, set) => {
  set(userFormModeAtom, "closed");
  set(editingUserAtom, undefined);
});

/** Write-only atom: opens the delete confirmation for a user. */
export const openDeleteUserDialogAtom = atom(null, (_get, set, user: DashboardUser) => {
  set(deletingUserAtom, user);
});

/** Write-only atom: closes the delete confirmation. */
export const closeDeleteUserDialogAtom = atom(null, (_get, set) => {
  set(deletingUserAtom, undefined);
});

/** Write-only atom: opens the password change dialog for a user. */
export const openPasswordChangeDialogAtom = atom(null, (_get, set, user: DashboardUser) => {
  set(passwordChangeUserAtom, user);
});

/** Write-only atom: closes the password change dialog. */
export const closePasswordChangeDialogAtom = atom(null, (_get, set) => {
  set(passwordChangeUserAtom, undefined);
});
