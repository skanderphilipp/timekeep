import { clsx } from "clsx";

import {
  useResizablePanel,
  type ResizablePanelConstraints,
  type ResizablePanelSide,
} from "@/infrastructure/side-panel/hooks/use-resizable-panel";
import styles from "./side-panel.module.scss";

// ── ResizablePanelGap ───────────────────────────────────────────────────────────

type ResizablePanelGapProps = {
  side: ResizablePanelSide;
  constraints: ResizablePanelConstraints;
  currentWidth: number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  /** CSS variable name set during drag for live visual feedback. */
  cssVariableName?: string;
  onResizeStart?: () => void;
};

/**
 * Invisible drag zone for resizing a panel.
 *
 * Uses negative margin to create a grab area wider than the visual gap,
 * so the handle is easy to hit even when panels are flush.
 *
 * Ported from Twenty's `ResizablePanelGap`.
 */
export function ResizablePanelGap({
  side,
  constraints,
  currentWidth,
  onWidthChange,
  onCollapse,
  cssVariableName,
  onResizeStart,
}: ResizablePanelGapProps) {
  const { isHovered, isResizing, handleMouseDown, handleMouseEnter, handleMouseLeave } =
    useResizablePanel({
      side,
      constraints,
      currentWidth,
      onWidthChange,
      onCollapse,
      cssVariableName,
      onResizeStart,
    });

  return (
    <div
      data-slot="resizable-panel-gap"
      data-side={side}
      data-hovered={isHovered || undefined}
      data-resizing={isResizing || undefined}
      className={clsx(styles.gap, styles[side])}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        data-slot="resizable-panel-handle"
        data-active={isResizing || undefined}
        data-hovered={isHovered || undefined}
        className={styles.handle}
      />
    </div>
  );
}
