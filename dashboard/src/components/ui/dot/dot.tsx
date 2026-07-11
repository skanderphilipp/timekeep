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
 * Decorative colored dot — no semantic meaning, no ARIA role.
 *
 * Use for visual-only indicators: calendar heat maps, legend swatches,
 * timeline color markers. Renders `aria-hidden="true"` — screen readers
 * ignore it.
 *
 * For live status indicators (online/offline/warning), use
 * `<StatusDot>` instead — it carries `role="status"` and an
 * `aria-label`.
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
