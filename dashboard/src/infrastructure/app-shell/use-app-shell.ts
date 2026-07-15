import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { useThemeColorScheme } from "@/infrastructure/theme";
import {
  toggleThemeAtom,
  sidebarOpenAtom,
  sidebarCollapsedState,
  logoutAtom,
  isAuthenticatedSelector,
} from "@/infrastructure/state";
import { useStateValue } from "@/infrastructure/state/jotai";
import { useNavigation } from "@/infrastructure/navigation/use-navigation";

/**
 * Centralized hook for all AppShell state and callbacks.
 *
 * Extracts sidebar, mobile, auth, theme, and navigation logic
 * from the AppShell component so it can remain a thin composite.
 */
export function useAppShell() {
  const isMobile = useIsMobile();
  const colorScheme = useThemeColorScheme();

  // ── Sidebar state ─────────────────────────────────────────────────────
  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const sidebarCollapsed = useStateValue(sidebarCollapsedState);
  const setSidebarCollapsed = useSetAtom(sidebarCollapsedState.atom);

  // ── Auth / theme ──────────────────────────────────────────────────────
  const toggleTheme = useSetAtom(toggleThemeAtom);
  const isAuthenticated = useStateValue(isAuthenticatedSelector);
  const logout = useSetAtom(logoutAtom);

  // ── Navigation ────────────────────────────────────────────────────────
  const navItems = useNavigation();

  // ── Callbacks ─────────────────────────────────────────────────────────
  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), [setSidebarOpen]);
  const toggleCollapse = useCallback(
    () => setSidebarCollapsed((c) => !c),
    [setSidebarCollapsed],
  );

  // ── Mobile: disable collapsed mode (desktop-only feature) ─────────────
  // The sidebar starts closed by default (atom default = false).
  // We do NOT force-close — only the user's burger click opens it.
  // This avoids race conditions where the effect fires during hydration
  // and overrides the user's toggle action.
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
    }
  }, [isMobile, setSidebarCollapsed]);

  return {
    isMobile,
    colorScheme,
    sidebarOpen,
    sidebarCollapsed,
    toggleTheme,
    toggleSidebar,
    toggleCollapse,
    closeSidebar,
    isAuthenticated,
    logout,
    navItems,
  };
}
