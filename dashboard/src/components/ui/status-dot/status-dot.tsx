import { clsx } from "clsx";

import styles from "./status-dot.module.scss";

type StatusDotProps = {
  status: "online" | "offline" | "warning";
  size?: "sm" | "md";
  pulsing?: boolean;
  className?: string;
};

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
