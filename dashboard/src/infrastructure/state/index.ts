/**
 * timekeep — Jotai State Management
 *
 * Barrel file for all application-wide atoms. Import like:
 *   import { themeAtom, toggleThemeAtom } from "@/infrastructure/state";
 */

export { themeAtom, toggleThemeAtom, type Theme } from "./atoms/theme";
export { sidebarOpenAtom, sidebarCollapsedAtom } from "./atoms/sidebar";
export { createFilterAtoms, type FilterAtoms } from "./atoms/filter";
export {
  authTokenAtom,
  isAuthenticatedAtom,
  logoutAtom,
  currentUserAtom,
  currentUserRoleAtom,
  isAdminAtom,
  isOperatorAtom,
  isViewerAtom,
  hasPermissionAtom,
} from "./atoms/auth";
export { endpointsAtom, systemSettingsAtom, settingsLoadedAtom } from "./atoms/settings";
export {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
  openSidePanelAtom,
  closeSidePanelAtom,
  sidePanelWidthAtom,
  SIDE_PANEL_CONSTRAINTS,
  SIDE_PANEL_WIDTH_VAR,
} from "./atoms/side-panel";
export {
  selectedUserIdAtom,
  editingUserAtom,
  userFormModeAtom,
  deletingUserAtom,
  passwordChangeUserAtom,
  isUserFormOpenAtom,
  isDeleteDialogOpenAtom,
  isPasswordDialogOpenAtom,
  openCreateUserFormAtom,
  openEditUserFormAtom,
  closeUserFormAtom,
  openDeleteUserDialogAtom,
  closeDeleteUserDialogAtom,
  openPasswordChangeDialogAtom,
  closePasswordChangeDialogAtom,
} from "./atoms/users";
