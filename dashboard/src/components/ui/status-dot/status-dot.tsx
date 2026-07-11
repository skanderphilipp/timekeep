import { clsx } from "clsx";

import styles from "./status-dot.module.scss";

type StatusDotProps = {
  status: "online" | "offline" | "warning";
  size?: "sm" | "md";
  pulsing?: boolean;
  className?: string;
};

/**
 * Semantic status indicator — `role="status"` with `aria-label`.
 *
 * Use for live status displays: device online/offline, system health,
 * database connectivity. Screen readers announce status changes.
 *
 * For purely decorative dots (calendar swatches, legends), use `<Dot>`
 * instead — it renders `aria-hidden="true"` and carries no semantic role.
 */
export function StatusDot({ status, size = "sm", pulsing = false, className }: StatusDotProps) {
  return (
    <span
      data-slot="status-dot"
      data-status={status}
      data-size={size}
      className={clsx(
        styles.dot,
        styles[status],
        styles[size],
        pulsing && status === "online" && styles.pulsing,
        className,
      )}
      role="status"
      aria-label={status}
    />
  );
}
