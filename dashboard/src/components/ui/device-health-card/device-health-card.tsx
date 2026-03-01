import { clsx } from "clsx";
import type { ReactNode } from "react";

import { ProgressBar } from "@/components/ui/progress-bar";

import styles from "./device-health-card.module.scss";

type DeviceHealthCardProps = {
  /** Icon or visual element. */
  icon?: ReactNode;
  /** Primary metric value. */
  value: string | number;
  /** Label below the value. */
  label: string;
  /** Optional subtitle (e.g. "3.9% used"). */
  subtitle?: string;
  /** Optional capacity bar: current / max. */
  capacity?: { current: number; max: number };
  /** Click handler (makes card interactive). */
  onClick?: () => void;
  className?: string;
};

/**
 * Device health card — a compact metric card for dashboard grids.
 *
 * Composable molecule built on:
 * - Raw divs for layout
 * - {@link ProgressBar} for capacity visualization
 *
 * Designed to sit inside a Card.Content or Section.
 */
export function DeviceHealthCard({
  icon,
  value,
  label,
  subtitle,
  capacity,
  onClick,
  className,
}: DeviceHealthCardProps) {
  const pct =
    capacity && capacity.max > 0
      ? Math.min(100, (capacity.current / capacity.max) * 100)
      : null;

  const barVariant =
    pct !== null
      ? pct >= 80
        ? "danger"
        : pct >= 60
          ? "warning"
          : "success"
      : "default";

  return (
    <div
      data-slot="device-health-card"
      className={clsx(styles.card, onClick && styles.clickable, className)}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {icon && <div className={styles.icon}>{icon}</div>}

      <div className={styles.body}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>

      {pct !== null && (
        <div className={styles.bar}>
          <ProgressBar
            value={Math.round(pct)}
            max={100}
            variant={barVariant}
            size="sm"
            showLabel={false}
          />
        </div>
      )}
    </div>
  );
}
