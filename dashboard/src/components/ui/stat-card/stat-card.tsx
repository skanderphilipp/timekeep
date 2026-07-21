import type { ReactNode } from "react";
import { clsx } from "clsx";

import { Card } from "../card";
import { ProgressBar } from "../progress-bar";

import styles from "./stat-card.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────

export type StatCardColor = "green" | "red" | "amber" | "accent" | "neutral";

/**
 * Capacity gauge displayed as a progress bar below the card body.
 * Only rendered when `capacity.max > 0` and `layout` is `"vertical"`.
 */
export type StatCardCapacity = {
  current: number;
  max: number;
};

export type StatCardProps = {
  /** Icon element (e.g. `<IconUsers size={20} />`). */
  icon?: ReactNode;
  /** Pre-translated label (use `_(msg\`...\`)` at the call site). */
  label: string;
  /** Primary value (string or number). */
  value: string | number;
  /** Optional secondary text below the value. */
  subtitle?: string;
  /**
   * Layout variant.
   * - `"vertical"` — icon on top, value prominent, label below, optional capacity bar.
   * - `"horizontal"` — icon + label/value side by side in a Card wrapper.
   *
   * @default "vertical"
   */
  layout?: "vertical" | "horizontal";
  /** Icon color accent. Only applies when `layout` is `"horizontal"`. */
  color?: StatCardColor;
  /** Capacity gauge (vertical layout only). */
  capacity?: StatCardCapacity;
  /** Makes the card interactive. */
  onClick?: () => void;
  className?: string;
  /**
   * Override the root `data-slot` attribute for E2E test selectors.
   * Defaults to `"stat-card"`. Use a unique value when multiple
   * StatCards appear on the same page (e.g., `"stat-card-present"`).
   */
  dataSlot?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const BAR_VARIANT_THRESHOLD_WARNING = 60;
const BAR_VARIANT_THRESHOLD_DANGER = 80;

function capacityPct(capacity: StatCardCapacity): number {
  if (capacity.max <= 0) return 0;
  return Math.min(100, (capacity.current / capacity.max) * 100);
}

function barVariant(pct: number): "success" | "warning" | "danger" {
  if (pct >= BAR_VARIANT_THRESHOLD_DANGER) return "danger";
  if (pct >= BAR_VARIANT_THRESHOLD_WARNING) return "warning";
  return "success";
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * StatCard — a unified metric card for dashboards, device health, and reports.
 *
 * Replaces both `MetricCard` (horizontal KPI cards) and `DeviceHealthCard`
 * (vertical stat cards with capacity bars). Choose the `layout` prop:
 *
 * - `"vertical"` — icon on top, prominent value, label below, optional
 *   capacity progress bar. Used for device health, storage gauges.
 * - `"horizontal"` — icon + label/value side by side in a `Card` wrapper.
 *   Icon color accent via `color` prop. Used for dashboard/report KPIs.
 *
 * All labels and subtitles are **pre-translated** by the caller using
 * Lingui `_(msg\`...\`)`. StatCard itself has zero i18n dependencies.
 */
export function StatCard({
  icon,
  label,
  value,
  subtitle,
  layout = "vertical",
  color,
  capacity,
  onClick,
  className,
  dataSlot,
}: StatCardProps) {
  const isHorizontal = layout === "horizontal";
  const pct = capacity ? capacityPct(capacity) : null;
  const showBar = !isHorizontal && pct !== null && capacity && capacity.max > 0;

  const body = (
    <div
      data-slot={dataSlot ?? "stat-card"}
      className={clsx(
        styles.card,
        isHorizontal ? styles.horizontal : styles.vertical,
        onClick && styles.clickable,
        className,
      )}
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
      {icon && (
        <div
          data-slot="stat-card-icon"
          className={clsx(styles.icon, isHorizontal && color && styles[color])}
        >
          {icon}
        </div>
      )}

      <div data-slot="stat-card-body" className={styles.body}>
        {isHorizontal && (
          <span data-slot="stat-card-label" className={styles.label}>
            {label}
          </span>
        )}
        <span data-slot="stat-card-value" className={styles.value}>
          {value}
        </span>
        {!isHorizontal && (
          <span data-slot="stat-card-label" className={styles.label}>
            {label}
          </span>
        )}
        {subtitle && (
          <span data-slot="stat-card-subtitle" className={styles.subtitle}>
            {subtitle}
          </span>
        )}
      </div>

      {showBar && (
        <div data-slot="stat-card-bar" className={styles.bar}>
          <ProgressBar
            value={Math.round(pct!)}
            max={100}
            variant={barVariant(pct!)}
            size="sm"
            showLabel={false}
          />
        </div>
      )}
    </div>
  );

  // Horizontal layout wraps in a Card for the background/border surface.
  if (isHorizontal) {
    return <Card>{body}</Card>;
  }

  return body;
}
