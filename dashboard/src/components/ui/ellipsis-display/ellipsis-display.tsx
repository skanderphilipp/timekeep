import { type ReactNode } from "react";
import { clsx } from "clsx";

import styles from "./ellipsis-display.module.scss";

export type EllipsisDisplayProps = {
  children: ReactNode;
  maxWidth?: number;
  className?: string;
};

/**
 * 1:1 port of Reaktly's EllipsisDisplay.
 *
 * Wraps content with overflow truncation. Simpler than OverflowingTextWithTooltip —
 * pure CSS ellipsis, no tooltip. Use for inline content that should not overflow.
 */
export function EllipsisDisplay({
  children,
  maxWidth,
  className,
}: EllipsisDisplayProps) {
  return (
    <div
      data-slot="ellipsis-display"
      className={clsx(styles.ellipsis, className)}
      style={
        maxWidth
          ? ({ "--ellipsis-max-width": `${maxWidth}px` } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
