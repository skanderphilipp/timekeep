import { useCallback, useLayoutEffect, type ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { IconX, IconArrowLeft } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
  closeSidePanelAtom,
  sidePanelWidthAtom,
  SIDE_PANEL_CONSTRAINTS,
  SIDE_PANEL_WIDTH_VAR,
} from "@/infrastructure/state";
import {
  sidePanelStackAtom,
  popSidePanelAtom,
} from "@/infrastructure/side-panel/side-panel-navigation-stack";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ResizablePanelGap } from "./resizable-panel-gap";
import styles from "./side-panel.module.scss";

// ── Props ─────────────────────────────────────────────────────────────────────

type SidePanelProps = {
  /**
   * When provided (by SidePanelShell), controls the panel directly.
   * When omitted, reads from Jotai atoms (AppShell usage).
   */
  open?: boolean;
  onClose?: () => void;
  title?: string;
  children?: ReactNode;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Permanent right side panel with resize handle.
 *
 * Supports two usage patterns:
 * 1. **Direct atom control** (AppShell): reads `sidePanelOpenAtom`,
 *    `sidePanelTitleAtom`, `sidePanelContentAtom` from Jotai. Pages push
 *    content via `openSidePanelAtom`.
 * 2. **Controlled props** (SidePanelShell): receives `open`, `onClose`,
 *    `title`, `children` directly. Used by the navigation stack router.
 *
 * Hidden on mobile (the panel is desktop-only).
 *
 * Features:
 * - Resize handle (drag to resize between 320–600px)
 * - Width persisted to localStorage via `sidePanelWidthAtom`
 * - CSS transition on open/close (width 0 ↔ var(--ao-side-panel-width))
 * - Scrollable content area with fade-in animation
 *
 * Ported from Twenty's `SidePanelForDesktop`.
 */
export function SidePanel({
  open: propOpen,
  onClose: propOnClose,
  title: propTitle,
  children: propChildren,
}: SidePanelProps) {
  const { _ } = useLingui();
  const isMobile = useIsMobile();

  // Atom state (used when props are not provided — direct usage from AppShell)
  const atomOpen = useAtomValue(sidePanelOpenAtom);
  const atomTitle = useAtomValue(sidePanelTitleAtom);
  const atomContent = useAtomValue(sidePanelContentAtom);
  const atomClose = useSetAtom(closeSidePanelAtom);

  // Navigation stack — back button support
  const navStack = useAtomValue(sidePanelStackAtom);
  const navPop = useSetAtom(popSidePanelAtom);
  const canGoBack = navStack.length > 1;

  const width = useAtomValue(sidePanelWidthAtom);
  const setWidth = useSetAtom(sidePanelWidthAtom);

  // Determine effective state
  const isControlled = propOpen !== undefined;
  const isOpen = propOpen ?? atomOpen;
  const displayTitle = propTitle ?? atomTitle ?? "";
  const content =
    propChildren ??
    (typeof atomContent === "function" ? atomContent() : null);
  const handleClose = propOnClose ?? (() => atomClose());

  // Set CSS custom property before first paint (prevents flash)
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      SIDE_PANEL_WIDTH_VAR,
      `${width}px`,
    );
  }, [width]);

  const handleWidthChange = useCallback(
    (newWidth: number) => {
      setWidth(newWidth);
      document.documentElement.style.setProperty(
        SIDE_PANEL_WIDTH_VAR,
        `${newWidth}px`,
      );
    },
    [setWidth],
  );

  const handleCollapse = useCallback(() => {
    handleClose();
  }, [handleClose]);

  // Hide the resize gap when the panel is closed (avoids invisible drag zone)
  const showGap = isControlled ? isOpen : isOpen;

  // Never render on mobile
  if (isMobile) return null;

  return (
    <>
      {showGap && (
        <ResizablePanelGap
          side="left"
          constraints={SIDE_PANEL_CONSTRAINTS}
          currentWidth={width}
          onWidthChange={handleWidthChange}
          onCollapse={handleCollapse}
          cssVariableName={SIDE_PANEL_WIDTH_VAR}
        />
      )}

      <aside
        data-slot="side-panel"
        data-open={isOpen || undefined}
        className={clsx(styles.panel, isOpen && styles.panelOpen)}
        aria-hidden={!isOpen}
      >
        <div data-slot="side-panel-inner" className={styles.inner}>
          {/* Header */}
          <div data-slot="side-panel-header" className={styles.header}>
            {canGoBack && (
              <button
                data-slot="side-panel-back"
                className={styles.closeButton}
                onClick={() => navPop()}
                aria-label={_(msg`Go back`)}
              >
                <IconArrowLeft size={16} />
              </button>
            )}
            <h3 data-slot="side-panel-title" className={styles.title}>
              {displayTitle}
            </h3>
            <button
              data-slot="side-panel-close"
              className={styles.closeButton}
              onClick={handleClose}
              aria-label={_(msg`Close panel`)}
            >
              <IconX size={16} />
            </button>
          </div>

          {/* Content */}
          <div data-slot="side-panel-content" className={styles.content}>
            {content}
          </div>
        </div>
      </aside>
    </>
  );
}
