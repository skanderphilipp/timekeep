import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./display.module.scss";

type EllipsisDisplayProps = {
  children: ReactNode;
  maxWidth?: number;
  className?: string;
};

/**
 * Base display wrapper with text truncation (ellipsis).
 *
 * All display components wrap their content in this to ensure
 * consistent single-line truncation in table cells and cards.
 */
export function EllipsisDisplay({
  children,
  maxWidth,
  className,
}: EllipsisDisplayProps) {
  return (
    <span
      data-slot="ellipsis-display"
      className={clsx(styles.ellipsis, className)}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {children}
    </span>
  );
}
