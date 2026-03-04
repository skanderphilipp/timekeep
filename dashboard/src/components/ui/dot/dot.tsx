import { clsx } from "clsx";

import styles from "./dot.module.scss";

type DotProps = {
  /** CSS class for the dot color (must include background-color). */
  color: string;
  /** Tooltip text shown on hover. */
  title?: string;
  /** Size variant. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Minimal colored dot indicator. Used in calendars, legends, and timelines
 * where a full StatusDot with ARIA semantics isn't appropriate.
 *
 * Renders as an 8px (sm) or 12px (md) colored circle.
 */
export function Dot({ color, title, size = "sm", className }: DotProps) {
  return (
    <span
      data-slot="dot"
      data-size={size}
      className={clsx(styles.dot, styles[size], color, className)}
      title={title}
      aria-hidden="true"
    />
  );
}
