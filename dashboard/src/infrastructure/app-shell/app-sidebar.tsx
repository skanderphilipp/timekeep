import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { clsx } from "clsx";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import type { ResolvedNavItem } from "@/infrastructure/navigation/use-navigation";
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
};

/**
 * Application sidebar — logo, navigation, and collapse toggle.
 *
 * Composes `NavGroup` and `NavLeaf` from `app-shell-nav.tsx` to render
 * the full navigation tree. Handles mobile overlay vs. desktop collapsed
 * states via CSS classes.
 */
export function AppSidebar({
  isOpen,
  isCollapsed,
  isMobile,
  navItems,
  onClose,
  onToggleCollapse,
}: AppSidebarProps) {
  const { _ } = useLingui();

  return (
    <aside
      data-slot="sidebar"
      className={clsx(
        styles.sidebar,
        isOpen && styles.sidebarOpen,
        !isMobile && isCollapsed && styles.sidebarCollapsed,
      )}
    >
      <div data-slot="sidebar-header" className={styles.sidebarHeader}>
        <span data-slot="sidebar-logo" className={styles.logo}>
          AO
        </span>
        {(!isMobile || isOpen) && (!isCollapsed || isMobile) && (
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

      {/* Hide collapse toggle on mobile — the sidebar is toggled via the menu button */}
      {!isMobile && (
        <div data-slot="sidebar-footer" className={styles.sidebarFooter}>
          <button
            data-slot="collapse-toggle"
            className={styles.collapseToggle}
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? _(msg`Expand sidebar`) : _(msg`Collapse sidebar`)}
          >
            {isCollapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
            {!isCollapsed && <span>{_(msg`Collapse`)}</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
