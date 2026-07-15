import { Link } from "react-router-dom";
import { IconMoon, IconSun, IconLogout, IconMenu2, IconX } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import type { BreadcrumbSegment } from "@/infrastructure/navigation/use-breadcrumbs";
import { LocaleSwitcher } from "@/infrastructure/locale/locale-switcher";
import { RoleBadge } from "@/modules/auth/components/role-badge";
import styles from "./app-top-bar.module.scss";

// ── AppTopBar ─────────────────────────────────────────────────────────────────

type AppTopBarProps = {
  isMobile: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  breadcrumbs: BreadcrumbSegment[];
  breadcrumbSeparator: Icon;
  colorScheme: "light" | "dark";
  onToggleTheme: () => void;
  isAuthenticated: boolean;
  onLogout: () => void;
};

/**
 * Application top bar — menu toggle, breadcrumbs, locale switcher, theme,
 * role badge, and sign-out button.
 */
export function AppTopBar({
  isMobile,
  sidebarOpen,
  onToggleSidebar,
  breadcrumbs,
  breadcrumbSeparator: BreadcrumbSeparator,
  colorScheme,
  onToggleTheme,
  isAuthenticated,
  onLogout,
}: AppTopBarProps) {
  const { _ } = useLingui();

  return (
    <header data-slot="top-bar" className={styles.topBar}>
      <div data-slot="top-bar-left" className={styles.topBarLeft}>
        <button
          data-slot="menu-toggle"
          className={styles.menuToggle}
          onClick={onToggleSidebar}
          aria-label={_(msg`Toggle menu`)}
        >
          {sidebarOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
        </button>

        {!isMobile && breadcrumbs.length > 0 && (
          <nav
            data-slot="breadcrumbs"
            className={styles.breadcrumbs}
            aria-label={_(msg`Breadcrumb`)}
          >
            {breadcrumbs.map((crumb, index) => (
              <span
                data-slot="breadcrumb-item"
                key={crumb.path}
                className={styles.breadcrumbItem}
              >
                {index > 0 && (
                  <BreadcrumbSeparator
                    data-slot="breadcrumb-separator"
                    size={14}
                    className={styles.breadcrumbSeparator}
                  />
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
          onClick={onToggleTheme}
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
            onClick={onLogout}
            aria-label={_(msg`Sign out`)}
            title={_(msg`Sign out`)}
          >
            <IconLogout size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
