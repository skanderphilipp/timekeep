import { atom } from "jotai";
import { createState, createSelector } from "@/infrastructure/state/jotai";
import type { DashboardUser } from "@/lib/api";

/**
 * User form module — Jotai atoms for user CRUD UI state.
 *
 * These atoms coordinate user management across views:
 * - The dashboard "checked-in" list can open the user editor
 * - The side panel can show user details
 * - The form mode persists across component mounts
 *
 * TanStack Query handles server state (user list fetching, mutations).
 * These atoms handle LOCAL UI state that multiple components may need.
 */

/** Which user is currently selected (for detail view, side panel, etc.). */
export const selectedUserIdState = createState<string | undefined>({
  key: "selectedUserId",
  defaultValue: undefined,
});

/** The user currently being edited. `undefined` means no edit in progress. */
export const editingUserState = createState<DashboardUser | undefined>({
  key: "editingUser",
  defaultValue: undefined,
});

/** Form mode: closed, creating a new user, or editing an existing one. */
export const userFormModeState = createState<"closed" | "create" | "edit">({
  key: "userFormMode",
  defaultValue: "closed",
});

/** User pending deletion confirmation. */
export const deletingUserState = createState<DashboardUser | undefined>({
  key: "deletingUser",
  defaultValue: undefined,
});

/** User for whom the password change dialog is open. */
export const passwordChangeUserState = createState<DashboardUser | undefined>({
  key: "passwordChangeUser",
  defaultValue: undefined,
});

/** Derived: whether the user form dialog should be open. */
export const isUserFormOpenSelector = createSelector({
  key: "isUserFormOpen",
  get: ({ get }) => get(userFormModeState) !== "closed",
});

/** Derived: whether the delete confirmation dialog should be open. */
export const isDeleteDialogOpenSelector = createSelector({
  key: "isDeleteDialogOpen",
  get: ({ get }) => get(deletingUserState) !== undefined,
});

/** Derived: whether the password change dialog should be open. */
export const isPasswordDialogOpenSelector = createSelector({
  key: "isPasswordDialogOpen",
  get: ({ get }) => get(passwordChangeUserState) !== undefined,
});

// ── Write-only action atoms ──────────────────────────────────────────────

/** Write-only atom: opens the create user form. */
export const openCreateUserFormAtom = atom(null, (_get, set) => {
  set(editingUserState.atom, undefined);
  set(userFormModeState.atom, "create");
});

/** Write-only atom: opens the edit form for a specific user. */
export const openEditUserFormAtom = atom(null, (_get, set, user: DashboardUser) => {
  set(editingUserState.atom, user);
  set(userFormModeState.atom, "edit");
});

/** Write-only atom: closes the form and clears editing state. */
export const closeUserFormAtom = atom(null, (_get, set) => {
  set(userFormModeState.atom, "closed");
  set(editingUserState.atom, undefined);
});

/** Write-only atom: opens the delete confirmation for a user. */
export const openDeleteUserDialogAtom = atom(null, (_get, set, user: DashboardUser) => {
  set(deletingUserState.atom, user);
});

/** Write-only atom: closes the delete confirmation. */
export const closeDeleteUserDialogAtom = atom(null, (_get, set) => {
  set(deletingUserState.atom, undefined);
});

/** Write-only atom: opens the password change dialog for a user. */
export const openPasswordChangeDialogAtom = atom(null, (_get, set, user: DashboardUser) => {
  set(passwordChangeUserState.atom, user);
});

/** Write-only atom: closes the password change dialog. */
export const closePasswordChangeDialogAtom = atom(null, (_get, set) => {
  set(passwordChangeUserState.atom, undefined);
});
