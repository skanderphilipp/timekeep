import { IconMenu2, IconX, IconChevronRight } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useAtomValue, useSetAtom } from "jotai";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { useGlobalHotkey } from "@/infrastructure/keyboard/hotkeys";
import {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
  closeSidePanelAtom,
  pageBreadcrumbLabelAtom,
} from "@/infrastructure/state";
import { SidePanelCmdk } from "@/infrastructure/side-panel/components/side-panel-cmdk";
import { useBreadcrumbs } from "@/infrastructure/navigation";
import { Breadcrumb } from "@/components/ui";
import styles from "./app-top-bar.module.scss";

// ── AppTopBar ─────────────────────────────────────────────────────────────────

type AppTopBarProps = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Whether the desktop sidebar is collapsed — shows expand button when true. */
  sidebarCollapsed?: boolean;
  /** Callback to expand the collapsed desktop sidebar. */
  onExpandSidebar?: () => void;
};

/**
 * Application top bar — visible on both desktop and mobile.
 *
 * Desktop: thin bar with a minimal Cmd+K keyboard shortcut on the right.
 * Mobile: menu toggle button on the left.
 *
 * Sits above the content row (page content + side panel) in the app shell.
 * The side panel slides open BELOW this bar — it does not overlap the top bar.
 *
 * The Cmd+K trigger is a clean keyboard badge (⌘K) — the actual search input
 * lives inside the side panel component ({@link SidePanelCmdk}).
 */
export function AppTopBar({
  sidebarOpen,
  onToggleSidebar,
  sidebarCollapsed,
  onExpandSidebar,
}: AppTopBarProps) {
  const isMobile = useIsMobile();
  const { _ } = useLingui();

  // Breadcrumbs — displayed left in the top bar, derived from the current route
  const pageLabel = useAtomValue(pageBreadcrumbLabelAtom);
  const breadcrumbs = useBreadcrumbs(pageLabel ? { dynamicLabel: pageLabel } : undefined);

  // Cmd+K toggle via the legacy side panel content atoms
  const isOpen = useAtomValue(sidePanelOpenAtom);
  const setOpen = useSetAtom(sidePanelOpenAtom);
  const setTitle = useSetAtom(sidePanelTitleAtom);
  const setContent = useSetAtom(sidePanelContentAtom);
  const close = useSetAtom(closeSidePanelAtom);

  const toggleCmdk = () => {
    if (isOpen) {
      close();
    } else {
      setTitle("Commands");
      setContent(() => <SidePanelCmdk onClose={() => close()} />);
      setOpen(true);
    }
  };

  // Register Cmd+K globally
  useGlobalHotkey(
    ["ctrl+k", "meta+k"],
    toggleCmdk,
    [isOpen, setOpen, setTitle, setContent, close],
  );

  return (
    <header data-slot="top-bar" className={styles.topBar}>
      {/* Mobile: menu toggle */}
      {isMobile && (
        <button
          data-slot="menu-toggle"
          className={styles.menuToggle}
          onClick={onToggleSidebar}
          aria-label={_(msg`Toggle menu`)}
        >
          {sidebarOpen ? <IconX size={18} /> : <IconMenu2 size={18} />}
        </button>
      )}

      {/* Desktop collapsed: expand sidebar button */}
      {!isMobile && sidebarCollapsed && onExpandSidebar && (
        <button
          data-slot="expand-sidebar"
          className={styles.menuToggle}
          onClick={onExpandSidebar}
          aria-label={_(msg`Expand sidebar`)}
          title={_(msg`Expand sidebar`)}
        >
          <IconChevronRight size={18} />
        </button>
      )}

      {/* Breadcrumbs — left side, derived from current route */}
      {!isMobile && breadcrumbs.length > 0 && (
        <nav data-slot="top-bar-breadcrumbs" className={styles.breadcrumbs} aria-label={_(msg`Breadcrumb`)}>
          <Breadcrumb segments={breadcrumbs} />
        </nav>
      )}

      {/* Spacer (pushes Cmd+K button to the right) */}
      <div className={styles.spacer} />

      {/* Cmd+K shortcut badge — always visible on desktop, hidden on mobile */}
      {!isMobile && (
        <button
          data-slot="cmdk-trigger"
          className={styles.cmdkButton}
          onClick={toggleCmdk}
          aria-label={_(msg`Search commands (Cmd+K)`)}
        >
          <kbd data-slot="cmdk-shortcut" className={styles.cmdkShortcut}>
            <span className={styles.cmdkKey}>⌘</span>
            <span className={styles.cmdkKey}>K</span>
          </kbd>
        </button>
      )}
    </header>
  );
}
