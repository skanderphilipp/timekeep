import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PieChart, useChartTheme } from "@/components/ui/chart";
import { ProgressBar } from "@/components/ui/progress-bar";

import styles from "./storage-gauge.module.scss";

/** Matches --ao-spacing-32 (128px). */
const GAUGE_SIZE = 128;

type StorageGaugeProps = {
  /** Percentage used (0–100). */
  percentage: number;
  /** Current count (e.g. 11489). */
  current: number;
  /** Maximum capacity (e.g. 100000). */
  capacity: number;
  /** Label below the gauge (e.g. "Records"). */
  label?: string;
  className?: string;
};

/**
 * Storage gauge — a donut chart showing used vs free capacity
 * with a centered percentage label, a progress bar, and count
 * details below.
 *
 * Color thresholds: green ≤60%, amber ≤80%, red >80%.
 * Uses chart-specific semantic colors (pre-resolved hex) so
 * Nivo never receives unparseable P3 or var() strings.
 */
export function StorageGauge({
  percentage,
  current,
  capacity,
  label,
  className,
}: StorageGaugeProps) {
  const { _ } = useLingui();
  const { semantic } = useChartTheme();

  const clamped = Math.max(0, Math.min(100, percentage));
  const free = 100 - clamped;

  const variant = clamped >= 80 ? "danger" : clamped >= 60 ? "warning" : "success";

  const usedColor =
    variant === "danger"
      ? semantic.negative
      : variant === "warning"
        ? semantic.warning
        : semantic.positive;

  const data = [
    { name: _(msg`Used`), value: clamped, color: usedColor },
    { name: _(msg`Free`), value: free, color: semantic.neutral },
  ];

  return (
    <div data-slot="storage-gauge" className={clsx(styles.container, className)}>
      <div className={styles.donut}>
        <PieChart data={data} donut showLegend={false} height={GAUGE_SIZE} />

        {/* Centered percentage overlay */}
        <div className={styles.overlay}>
          <span className={clsx(styles.percentage, styles[variant])}>{clamped.toFixed(0)}%</span>
          <span className={styles.overlayLabel}>{_(msg`used`)}</span>
        </div>
      </div>

      {label && <span className={styles.label}>{label}</span>}

      <div className={styles.countRow}>
        <ProgressBar value={clamped} max={100} variant={variant} size="md" showLabel={false} />
        <span className={styles.count}>
          {current.toLocaleString()} / {capacity.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
