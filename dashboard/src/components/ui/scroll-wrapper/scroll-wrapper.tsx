import { type ReactNode, type UIEventHandler, useCallback } from "react";
import { clsx } from "clsx";

import styles from "./scroll-wrapper.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ScrollWrapperProps = {
  children: ReactNode;
  /** Enable horizontal scrolling. Default: false. */
  enableX?: boolean;
  /** Enable vertical scrolling. Default: false. */
  enableY?: boolean;
  /** Called on scroll with { scrollTop, scrollLeft }. */
  onScroll?: (pos: { scrollTop: number; scrollLeft: number }) => void;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Lightweight scroll container with conditional axis enabling.
 *
 * Inspired by Twenty's ScrollWrapper but without Jotai state tracking.
 * Use `onScroll` for optional scroll position callbacks (e.g., syncing
 * multiple scroll containers).
 *
 * Default behavior: both axes hidden. Enable explicitly with `enableX` / `enableY`.
 *
 * @example
 * ```tsx
 * <ScrollWrapper enableX enableY onScroll={handleScroll}>
 *   <div style={{ minWidth: 1200 }}>Wide content</div>
 * </ScrollWrapper>
 * ```
 */
export function ScrollWrapper({
  children,
  enableX = false,
  enableY = false,
  onScroll,
  className,
}: ScrollWrapperProps) {
  const handleScroll: UIEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (!onScroll) return;
      const target = event.currentTarget;
      onScroll({ scrollTop: target.scrollTop, scrollLeft: target.scrollLeft });
    },
    [onScroll],
  );

  return (
    <div
      data-slot="scroll-wrapper"
      data-scroll-x={enableX || undefined}
      data-scroll-y={enableY || undefined}
      className={clsx(
        styles.root,
        enableX && styles.scrollX,
        enableY && styles.scrollY,
        className,
      )}
      onScroll={onScroll ? handleScroll : undefined}
    >
      {children}
    </div>
  );
}

ScrollWrapper.displayName = "ScrollWrapper";
