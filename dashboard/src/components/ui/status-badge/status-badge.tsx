import { clsx } from "clsx";
import { StatusDot } from "../status-dot";
import { Text } from "../text";

import styles from "./status-badge.module.scss";

type StatusBadgeProps = {
  /** One of "online", "offline", "warning" — forwarded to StatusDot. */
  status: "online" | "offline" | "warning";
  /** Label text displayed next to the dot. */
  label: string;
  /** When false, applies reduced opacity (e.g. for inactive protocol indicators). */
  active?: boolean;
};

/**
 * Dot + label combo for health/status indicators.
 *
 * Used for: system health, database status, device protocol indicators
 * (ADMS, SDK). When `active` is false, renders at 50% opacity.
 */
export function StatusBadge({ status, label, active = true }: StatusBadgeProps) {
  return (
    <span className={clsx(styles.badge, !active && styles.dimmed)}>
      <StatusDot status={status} />
      <Text as="span" variant="body">{label}</Text>
    </span>
  );
}
