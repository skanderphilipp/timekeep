import { type ReactNode, useCallback, useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  IconMoon,
  IconSun,
  IconLogout,
  IconMenu2,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useAtomValue, useSetAtom } from "jotai";

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
import { LocaleSwitcher } from "@/infrastructure/locale/locale-switcher";
import { RoleBadge } from "@/infrastructure/role-badge";
import { useNavigation, type ResolvedNavItem } from "@/infrastructure/navigation/use-navigation";
import { useBreadcrumbs } from "@/infrastructure/navigation/use-breadcrumbs";
import { SidePanelShell } from "@/infrastructure/side-panel/side-panel-shell";
import styles from "./app-shell.module.scss";

// ── NavItem (leaf) ────────────────────────────────────────────────────────────

function NavLeaf({
  item,
  collapsed,
  onClick,
}: {
  item: ResolvedNavItem;
  collapsed: boolean;
  onClick: () => void;
}) {
  if (!item.path) return null;

  return (
    <NavLink
      key={item.key}
      to={item.path!}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          styles.navItem,
          !item.icon && styles.navItemNested,
          isActive && styles.navItemActive,
        )
      }
      title={collapsed ? item.label() : undefined}
    >
      {item.icon && <item.icon data-slot="nav-icon" size={20} />}
      {!collapsed && <span data-slot="nav-label">{item.label()}</span>}
    </NavLink>
  );
}

// ── NavGroup (collapsible parent) ─────────────────────────────────────────────

function NavGroup({
  item,
  collapsed,
  closeSidebar,
}: {
  item: ResolvedNavItem;
  collapsed: boolean;
  closeSidebar: () => void;
}) {
  const location = useLocation();
  const isChildActive =
    item.children?.some((c) => location.pathname.startsWith(c.path ?? "")) ?? false;
  const [expanded, setExpanded] = useState(isChildActive);

  if (collapsed) {
    // When collapsed, show only the parent icon (no expand)
    return (
      <div data-slot="nav-group-collapsed" className={styles.navGroupCollapsed}>
        <div className={clsx(styles.navItem, isChildActive && styles.navItemActive)}>
          {item.icon && <item.icon data-slot="nav-icon" size={20} />}
        </div>
        {item.children?.map((child) => (
          <NavLeaf key={child.key} item={child} collapsed={collapsed} onClick={closeSidebar} />
        ))}
      </div>
    );
  }

  return (
    <div data-slot="nav-group" className={styles.navGroup}>
      <button
        data-slot="nav-group-header"
        className={clsx(styles.navGroupHeader, isChildActive && styles.navGroupHeaderActive)}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {item.icon && <item.icon data-slot="nav-icon" size={20} />}
        <span data-slot="nav-label" className={styles.navGroupLabel}>
          {item.label()}
        </span>
        <IconChevronDown
          size={14}
          className={clsx(styles.navGroupChevron, expanded && styles.navGroupChevronOpen)}
        />
      </button>
      {expanded && (
        <div data-slot="nav-group-children" className={styles.navGroupChildren}>
          {item.children?.map((child) => (
            <NavLeaf key={child.key} item={child} collapsed={false} onClick={closeSidebar} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

type AppShellProps = {
  children: ReactNode;
};

/**
 * Application shell — composes the sidebar, top bar, and content area.
 *
 * This component is a THIN COMPOSITE. It contains NO business logic:
 * - Navigation model → `infrastructure/navigation/`
 * - Role filtering → `infrastructure/navigation/use-navigation`
 * - Breadcrumb derivation → `infrastructure/navigation/use-breadcrumbs`
 * - Role badge → `infrastructure/role-badge/`
 * - Auth state → `infrastructure/state/`
 *
 * All behavioral logic lives in infrastructure hooks and components.
 * The shell only wires them together and renders layout markup.
 */
export function AppShell({ children }: AppShellProps) {
  const { _ } = useLingui();
  const dir = useDirection();
  const isMobile = useIsMobile();
  const BreadcrumbSeparator = chevronForDirection(dir, true);
  const colorScheme = useThemeColorScheme();

  // ── Infrastructure hooks ──────────────────────────────────────────
  const toggleTheme = useSetAtom(toggleThemeAtom);
  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const sidebarCollapsed = useAtomValue(sidebarCollapsedAtom);
  const setSidebarCollapsed = useSetAtom(sidebarCollapsedAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const logout = useSetAtom(logoutAtom);

  const navItems = useNavigation();
  const breadcrumbs = useBreadcrumbs();
  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  // On mobile, auto-collapse the sidebar and disable desktop collapsed state
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
      setSidebarOpen(false);
    }
  }, [isMobile, setSidebarCollapsed, setSidebarOpen]);

  return (
    <div data-slot="app-shell" className={styles.shell}>
      <a data-slot="skip-to-content" className={styles.skipLink} href="#main-content">
        {_(msg`Skip to content`)}
      </a>
      {sidebarOpen && (
        <div
          data-slot="sidebar-overlay"
          className={styles.overlay}
          role="button"
          tabIndex={-1}
          onClick={closeSidebar}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") closeSidebar();
          }}
        />
      )}

      <aside
        data-slot="sidebar"
        className={clsx(
          styles.sidebar,
          sidebarOpen && styles.sidebarOpen,
          !isMobile && sidebarCollapsed && styles.sidebarCollapsed,
        )}
      >
        <div data-slot="sidebar-header" className={styles.sidebarHeader}>
          <span data-slot="sidebar-logo" className={styles.logo}>
            AO
          </span>
          {(!isMobile || sidebarOpen) && (!sidebarCollapsed || isMobile) && (
            <span data-slot="sidebar-brand" className={styles.brand}>
              timekeep
            </span>
          )}
        </div>

        <nav data-slot="sidebar-nav" className={styles.nav}>
          {navItems.map((item) =>
            item.children ? (
              <NavGroup
                key={item.key}
                item={item}
                collapsed={!isMobile && sidebarCollapsed}
                closeSidebar={closeSidebar}
              />
            ) : (
              <NavLeaf
                key={item.key}
                item={item}
                collapsed={!isMobile && sidebarCollapsed}
                onClick={closeSidebar}
              />
            ),
          )}
        </nav>

        {/* Hide collapse toggle on mobile — the sidebar is toggled via the menu button */}
        {!isMobile && (
          <div data-slot="sidebar-footer" className={styles.sidebarFooter}>
            <button
              data-slot="collapse-toggle"
              className={styles.collapseToggle}
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? _(msg`Expand sidebar`) : _(msg`Collapse sidebar`)}
            >
              {sidebarCollapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
              {!sidebarCollapsed && <span>{_(msg`Collapse`)}</span>}
            </button>
          </div>
        )}
      </aside>

      <div data-slot="main" className={styles.main}>
        <header data-slot="top-bar" className={styles.topBar}>
          <div data-slot="top-bar-left" className={styles.topBarLeft}>
            <button
              data-slot="menu-toggle"
              className={styles.menuToggle}
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={_(msg`Toggle menu`)}
            >
              {sidebarOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
            </button>

            {!isMobile && breadcrumbs.length > 0 && (
              <nav data-slot="breadcrumbs" className={styles.breadcrumbs} aria-label={_(msg`Breadcrumb`)}>
                {breadcrumbs.map((crumb, index) => (
                  <span data-slot="breadcrumb-item" key={crumb.path} className={styles.breadcrumbItem}>
                    {index > 0 && (
                      <BreadcrumbSeparator data-slot="breadcrumb-separator" size={14} className={styles.breadcrumbSeparator} />
                    )}
                    <Link
                      data-slot="breadcrumb-link"
                      to={crumb.path}
                      className={styles.breadcrumbLink}
                    >
                      {crumb.label}
                    </Link>
                  </span>
                ))}
              </nav>
            )}
          </div>

          <div data-slot="top-bar-actions" className={styles.topBarActions}>
            <LocaleSwitcher />
            <button
              data-slot="theme-toggle"
              className={styles.topBarButton}
              onClick={toggleTheme}
              aria-label={_(msg`Toggle theme`)}
              title={colorScheme === "dark" ? _(msg`Light Mode`) : _(msg`Dark Mode`)}
            >
              {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            {!isMobile && <RoleBadge />}
            {isAuthenticated && (
              <button
                data-slot="logout-button"
                className={styles.topBarButton}
                onClick={logout}
                aria-label={_(msg`Sign out`)}
                title={_(msg`Sign out`)}
              >
                <IconLogout size={18} />
              </button>
            )}
          </div>
        </header>

        <main data-slot="content" id="main-content" className={styles.content}>
          {children}
        </main>
      </div>

      <SidePanelShell />
    </div>
  );
}
