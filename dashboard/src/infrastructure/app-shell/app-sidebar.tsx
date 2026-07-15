import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { clsx } from "clsx";
import {
  IconChevronLeft,
  IconMoon,
  IconSun,
  IconLogout,
  IconSearch,
} from "@tabler/icons-react";
import { useSetAtom } from "jotai";

import type { ResolvedNavItem } from "@/infrastructure/navigation/use-navigation";
import { LocaleSwitcher } from "@/infrastructure/locale/locale-switcher";
import { RoleBadge } from "@/modules/auth/components/role-badge";
import { TimeKeepLogo } from "@/modules/auth/components/timekeep-logo";
import { SidePanelCmdk } from "@/infrastructure/side-panel/components/side-panel-cmdk";
import {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
  closeSidePanelAtom,
} from "@/infrastructure/state";
import { WORKSPACE_NAME } from "@/lib/constants";
import { NavGroup, NavLeaf } from "@/app-shell-nav";
import styles from "./app-sidebar.module.scss";

// ── AppSidebar ────────────────────────────────────────────────────────────────

type AppSidebarProps = {
  isOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  navItems: ResolvedNavItem[];
  onClose: () => void;
  onToggleCollapse: () => void;
  colorScheme: "light" | "dark";
  onToggleTheme: () => void;
  isAuthenticated: boolean;
  onLogout: () => void;
};

/**
 * Application sidebar — Twenty-aligned with proper mobile support,
 * clean collapsed behavior, TimeKeep clock logo, and organized footer.
 *
 * Structure:
 *   Header  — clock logo + workspace name + search + collapse (desktop expanded only)
 *   Nav     — scrollable navigation tree
 *   Footer  — theme, locale, role, logout
 */
export function AppSidebar({
  isOpen,
  isCollapsed,
  isMobile,
  navItems,
  onClose,
  onToggleCollapse,
  colorScheme,
  onToggleTheme,
  isAuthenticated,
  onLogout,
}: AppSidebarProps) {
  const { _ } = useLingui();
  const setSidePanelOpen = useSetAtom(sidePanelOpenAtom);
  const setSidePanelTitle = useSetAtom(sidePanelTitleAtom);
  const setSidePanelContent = useSetAtom(sidePanelContentAtom);
  const closeSidePanel = useSetAtom(closeSidePanelAtom);

  const handleOpenSearch = () => {
    setSidePanelTitle("Commands");
    setSidePanelContent(() => <SidePanelCmdk onClose={() => closeSidePanel()} />);
    setSidePanelOpen(true);
  };

  /** Whether the sidebar shows labels (expanded mode). */
  const isExpanded = isMobile ? isOpen : !isCollapsed;

  return (
    <aside
      data-slot="sidebar"
      className={clsx(
        styles.sidebar,
        isOpen && styles.sidebarOpen,
        !isMobile && isCollapsed && styles.sidebarCollapsed,
      )}
    >
      {/* ── Header: logo + workspace + actions ─────────────────────────── */}
      <header data-slot="sidebar-header" className={styles.header}>
        <div data-slot="sidebar-brand" className={styles.brand}>
          <TimeKeepLogo className={styles.logo} />
          {isExpanded && (
            <div data-slot="sidebar-brand-text" className={styles.brandTextGroup}>
              <span className={styles.appName}>TimeKeep</span>
              <span className={styles.workspaceName}>{WORKSPACE_NAME}</span>
            </div>
          )}
        </div>

        {isExpanded && (
          <div data-slot="sidebar-header-actions" className={styles.headerActions}>
            {/* Search / command palette trigger */}
            <button
              data-slot="sidebar-search"
              className={styles.iconButton}
              onClick={handleOpenSearch}
              aria-label={_(msg`Search (Cmd+K)`)}
              title={_(msg`Search (Cmd+K)`)}
            >
              <IconSearch size={18} />
            </button>

            {/* Desktop collapse toggle — only when expanded */}
            {!isMobile && (
              <button
                data-slot="sidebar-collapse"
                className={styles.iconButton}
                onClick={onToggleCollapse}
                aria-label={_(msg`Collapse sidebar`)}
                title={_(msg`Collapse sidebar`)}
              >
                <IconChevronLeft size={18} />
              </button>
            )}
          </div>
        )}

        {/* Mobile close button */}
        {isMobile && isOpen && (
          <button
            data-slot="sidebar-close"
            className={styles.iconButton}
            onClick={onClose}
            aria-label={_(msg`Close sidebar`)}
          >
            <IconChevronLeft size={18} />
          </button>
        )}
      </header>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav data-slot="sidebar-nav" className={styles.nav}>
        {navItems.map((item) =>
          item.children ? (
            <NavGroup
              key={item.key}
              item={item}
              collapsed={!isMobile && isCollapsed}
              closeSidebar={onClose}
            />
          ) : (
            <NavLeaf
              key={item.key}
              item={item}
              collapsed={!isMobile && isCollapsed}
              onClick={onClose}
            />
          ),
        )}
      </nav>

      {/* ── Footer: user controls ─────────────────────────────────────── */}
      {isExpanded && (
        <footer data-slot="sidebar-footer" className={styles.footer}>
          <div data-slot="sidebar-footer-controls" className={styles.footerControls}>
            <LocaleSwitcher />

            <button
              data-slot="sidebar-theme-toggle"
              className={styles.footerIconButton}
              onClick={onToggleTheme}
              aria-label={_(msg`Toggle theme`)}
              title={colorScheme === "dark" ? _(msg`Light Mode`) : _(msg`Dark Mode`)}
            >
              {colorScheme === "dark" ? (
                <IconSun size={18} />
              ) : (
                <IconMoon size={18} />
              )}
            </button>

            <RoleBadge />

            {isAuthenticated && (
              <button
                data-slot="sidebar-logout"
                className={styles.footerIconButton}
                onClick={onLogout}
                aria-label={_(msg`Sign out`)}
                title={_(msg`Sign out`)}
              >
                <IconLogout size={18} />
              </button>
            )}
          </div>
        </footer>
      )}
    </aside>
  );
}
