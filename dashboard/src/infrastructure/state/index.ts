/**
 * timekeep — Jotai State Management
 *
 * Barrel file for all application-wide atoms. Import like:
 *   import { themeState, toggleThemeAtom } from "@/infrastructure/state";
 *
 * ## Naming Convention
 *
 * - **State:** `{descriptor}State` → `themeState`, `authTokenState`
 * - **Selector:** `{descriptor}Selector` → `isAuthenticatedSelector`
 * - **Atom:** `{descriptor}Atom` → `toggleThemeAtom`, `logoutAtom` (write-only action atoms only)
 */

// ── Theme ──────────────────────────────────────────────────────────────

export { themeState, toggleThemeAtom, type Theme } from "./atoms/theme";

// ── Sidebar ────────────────────────────────────────────────────────────

export { sidebarOpenAtom, sidebarCollapsedState } from "./atoms/sidebar";

// ── Filter ─────────────────────────────────────────────────────────────

export { createFilterAtoms, type FilterAtoms } from "./atoms/filter";

// ── Auth ───────────────────────────────────────────────────────────────

export {
  authTokenState,
  isAuthenticatedSelector,
  currentUserState,
  currentUserRoleSelector,
  isAdminSelector,
  isOperatorSelector,
  isViewerSelector,
  logoutAtom,
  hasPermissionAtom,
} from "./atoms/auth";

// ── Settings ───────────────────────────────────────────────────────────

export {
  endpointsState,
  systemSettingsState,
  settingsLoadedState,
} from "./atoms/settings";

// ── Client Config ──────────────────────────────────────────────────────

export { clientConfigState } from "./atoms/client-config";

// ── Server URL (Tauri desktop) ─────────────────────────────────────────

export { serverUrlState, setServerUrlAtom, apiBaseUrlAtom } from "./atoms/server-url";

// ── Side Panel ─────────────────────────────────────────────────────────

export {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
  openSidePanelAtom,
  closeSidePanelAtom,
  sidePanelWidthState,
  SIDE_PANEL_CONSTRAINTS,
  SIDE_PANEL_WIDTH_VAR,
} from "./atoms/side-panel";

// ── Breadcrumb ─────────────────────────────────────────────────────────

export { pageBreadcrumbLabelAtom } from "./atoms/breadcrumb";

// ── Inline Editing ─────────────────────────────────────────────────────

export {
  editingCellIdAtom,
  buildCellId,
  useIsEditingCell,
  useEnterEditMode,
  useExitEditMode,
  useCellNavigator,
} from "./atoms/editing-cell";
