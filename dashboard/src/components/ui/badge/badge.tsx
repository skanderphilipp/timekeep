import { clsx } from "clsx";
import { type ReactNode } from "react";
import { type Icon as TablerIcon } from "@tabler/icons-react";

import { StatusDot } from "../status-dot";

import styles from "./badge.module.scss";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";
type BadgeSize = "sm" | "md";
/** Matches StatusDot's status values. */
type BadgeDotStatus = "online" | "offline" | "warning";

type BadgeProps = {
  /** Semantic color variant. */
  variant?: BadgeVariant;
  /** Size. */
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
  /**
   * Render as a fully-rounded pill (compact, uppercase, xx-small).
   * Replaces the former `<Pill>` component.
   */
  pill?: boolean;
  /** Optional leading icon. Inspired by the former `<Pill>` component. */
  icon?: TablerIcon;
  /**
   * Optional status dot prefix — renders a `<StatusDot>` before children.
   * Replaces the former `<StatusBadge>` and `<DeviceStatusBadge>` components.
   * Combine with `variant` for device status displays.
   */
  dot?: BadgeDotStatus;
};

/**
 * Badge — compact status/count indicator.
 *
 * Used across the app for status labels, counts, device health,
 * and KPI chips. Supports three composition modes:
 *
 * - **Default**: rounded rectangle with semantic color variant.
 * - **Pill**: fully-rounded, uppercase, xx-small — for "Soon", "Beta", etc.
 * - **With dot**: prefixed by a `<StatusDot>` — for live health indicators.
 */
export function Badge({
  variant = "neutral",
  size = "sm",
  children,
  className,
  pill = false,
  icon: Icon,
  dot,
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      data-pill={pill || undefined}
      className={clsx(styles.badge, styles[variant], styles[size], pill && styles.pill, className)}
    >
      {dot && <StatusDot status={dot} size="sm" className={styles.dot} />}
      {Icon && <Icon size={pill ? 10 : 12} aria-hidden="true" className={styles.icon} />}
      {children}
    </span>
  );
}
