import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { Icon } from "@tabler/icons-react";

import { useDirection } from "@/hooks/use-direction";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { chevronForDirection } from "@/lib/icon-flip";
import { useThemeColorScheme } from "@/infrastructure/theme";
import {
  toggleThemeAtom,
  sidebarOpenAtom,
  sidebarCollapsedAtom,
  logoutAtom,
  isAuthenticatedAtom,
} from "@/infrastructure/state";
import { useNavigation } from "@/infrastructure/navigation/use-navigation";
import { useBreadcrumbs } from "@/infrastructure/navigation/use-breadcrumbs";

/**
 * Centralized hook for all AppShell state and callbacks.
 *
 * Extracts sidebar, mobile, auth, theme, navigation, and breadcrumb logic
 * from the AppShell component so it can remain a thin composite.
 */
export function useAppShell() {
  const dir = useDirection();
  const isMobile = useIsMobile();
  const colorScheme = useThemeColorScheme();
  const breadcrumbSeparator: Icon = chevronForDirection(dir, true);

  // ── Sidebar state ─────────────────────────────────────────────────────
  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const sidebarCollapsed = useAtomValue(sidebarCollapsedAtom);
  const setSidebarCollapsed = useSetAtom(sidebarCollapsedAtom);

  // ── Auth / theme ──────────────────────────────────────────────────────
  const toggleTheme = useSetAtom(toggleThemeAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const logout = useSetAtom(logoutAtom);

  // ── Navigation ────────────────────────────────────────────────────────
  const navItems = useNavigation();
  const breadcrumbs = useBreadcrumbs();

  // ── Callbacks ─────────────────────────────────────────────────────────
  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), [setSidebarOpen]);
  const toggleCollapse = useCallback(
    () => setSidebarCollapsed((c) => !c),
    [setSidebarCollapsed],
  );

  // On mobile, auto-close sidebar and disable collapsed state
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
      setSidebarOpen(false);
    }
  }, [isMobile, setSidebarCollapsed, setSidebarOpen]);

  return {
    isMobile,
    colorScheme,
    breadcrumbSeparator,
    sidebarOpen,
    sidebarCollapsed,
    toggleTheme,
    toggleSidebar,
    toggleCollapse,
    closeSidebar,
    isAuthenticated,
    logout,
    navItems,
    breadcrumbs,
  };
}
