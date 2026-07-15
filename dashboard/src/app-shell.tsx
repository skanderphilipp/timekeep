import { type ReactNode } from "react";

import {
  useAppShell,
  SkipToContent,
  MobileOverlay,
  AppSidebar,
  AppTopBar,
} from "@/infrastructure/app-shell";
import { SidePanelShell } from "@/infrastructure/side-panel/side-panel-shell";
import styles from "./app-shell.module.scss";

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
 * - Auth state → `infrastructure/state/`
 * - Shell state → `infrastructure/app-shell/use-app-shell`
 *
 * All behavioral logic lives in infrastructure hooks and components.
 * The shell only wires them together and renders layout markup.
 */
export function AppShell({ children }: AppShellProps) {
  const shell = useAppShell();

  return (
    <div data-slot="app-shell" className={styles.shell}>
      <SkipToContent />
      <MobileOverlay open={shell.sidebarOpen} onClick={shell.closeSidebar} />

      <AppSidebar
        isOpen={shell.sidebarOpen}
        isCollapsed={shell.sidebarCollapsed}
        isMobile={shell.isMobile}
        navItems={shell.navItems}
        onClose={shell.closeSidebar}
        onToggleCollapse={shell.toggleCollapse}
      />

      <div data-slot="main" className={styles.main}>
        <AppTopBar
          isMobile={shell.isMobile}
          sidebarOpen={shell.sidebarOpen}
          onToggleSidebar={shell.toggleSidebar}
          breadcrumbs={shell.breadcrumbs}
          breadcrumbSeparator={shell.breadcrumbSeparator}
          colorScheme={shell.colorScheme}
          onToggleTheme={shell.toggleTheme}
          isAuthenticated={shell.isAuthenticated}
          onLogout={shell.logout}
        />

        <main data-slot="content" id="main-content" className={styles.content}>
          {children}
        </main>
      </div>

      <SidePanelShell />
    </div>
  );
}
