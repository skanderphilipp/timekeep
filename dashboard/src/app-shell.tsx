import { type ReactNode } from "react";

import {
  useAppShell,
  SkipToContent,
  MobileOverlay,
  AppSidebar,
  AppTopBar,
} from "@/infrastructure/app-shell";
import { SidePanelShell } from "@/infrastructure/side-panel/side-panel-shell";
import { GlobalCommandsRegistrar } from "@/infrastructure/commands";
import { MetadataHydrator } from "@/modules/metadata-store";
import styles from "./app-shell.module.scss";

// ── AppShell ──────────────────────────────────────────────────────────────────

type AppShellProps = {
  children: ReactNode;
};

/**
 * Application shell — composes the sidebar, top bar, content area, and
 * side panel into a Twenty-aligned flex layout.
 *
 * Structure:
 * ```
 * AppShell
 *   ├── AppSidebar (sticky, left)
 *   └── Main column (flex: 1)
 *        ├── AppTopBar (sticky, full width)
 *        └── Content row (flex: 1, flex row)
 *             ├── Page content (flex: 1)  ← children (PageShell)
 *             └── SidePanel (flex-shrink: 0)  ← panendels in flow, pushes content
 * ```
 *
 * The side panel no longer uses sticky positioning — it sits in the same
 * flex row as the page content and pushes it left when open.
 */
export function AppShell({ children }: AppShellProps) {
  const shell = useAppShell();

  return (
    <div data-slot="app-shell" className={styles.shell}>
      <MetadataHydrator />
      <GlobalCommandsRegistrar />
      <SkipToContent />
      <MobileOverlay open={shell.sidebarOpen} onClick={shell.closeSidebar} />

      <AppSidebar
        isOpen={shell.sidebarOpen}
        isCollapsed={shell.sidebarCollapsed}
        isMobile={shell.isMobile}
        navItems={shell.navItems}
        onClose={shell.closeSidebar}
        onToggleCollapse={shell.toggleCollapse}
        colorScheme={shell.colorScheme}
        onToggleTheme={shell.toggleTheme}
        isAuthenticated={shell.isAuthenticated}
        onLogout={shell.logout}
      />

      <div data-slot="main" className={styles.main}>
        <AppTopBar
          sidebarOpen={shell.sidebarOpen}
          onToggleSidebar={shell.toggleSidebar}
          sidebarCollapsed={shell.sidebarCollapsed}
          onExpandSidebar={shell.toggleCollapse}
        />

        <div data-slot="content-row" className={styles.contentRow}>
          <main data-slot="content" id="main-content" className={styles.content}>
            {children}
          </main>

          <SidePanelShell />
        </div>
      </div>
    </div>
  );
}
