import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PieChart } from "@/components/ui/chart";
import { ProgressBar } from "@/components/ui/progress-bar";

import styles from "./storage-gauge.module.scss";

type StorageGaugeProps = {
  /** Percentage used (0–100). */
  percentage: number;
  /** Current count (e.g. 11489). */
  current: number;
  /** Maximum capacity (e.g. 100000). */
  capacity: number;
  /** Label below the gauge (e.g. "Records"). */
  label?: string;
  /** Size in pixels. */
  size?: number;
  /** Show progress bar instead of count text. */
  showCount?: boolean;
  className?: string;
};

/**
 * Storage gauge — a donut chart showing used vs free capacity
 * with a centered percentage label.
 *
 * Composable molecule built on:
 * - {@link PieChart} (Recharts donut, from our chart library)
 * - {@link ProgressBar} (linear bar for the count/capacity visualization)
 *
 * Color thresholds: green ≤60%, amber ≤80%, red >80%.
 */
export function StorageGauge({
  percentage,
  current,
  capacity,
  label,
  showCount = true,
  className,
}: StorageGaugeProps) {
  const { _ } = useLingui();
  const clamped = Math.max(0, Math.min(100, percentage));
  const free = 100 - clamped;

  const variant = clamped >= 80 ? "danger" : clamped >= 60 ? "warning" : "success";

  const data = [
    { name: _(msg`Used`), value: clamped, color: "var(--ao-accent-accent9)" },
    { name: _(msg`Free`), value: free, color: "var(--ao-color-gray4)" },
  ];

  // Override colors based on threshold
  if (variant === "danger") {
    data[0].color = "var(--ao-color-red9)";
  } else if (variant === "warning") {
    data[0].color = "var(--ao-color-amber9)";
  } else {
    data[0].color = "var(--ao-color-green9)";
  }

  return (
    <div data-slot="storage-gauge" className={clsx(styles.container, className)}>
      <div className={styles.donut}>
        <PieChart data={data} donut showLegend={false} />
        {/* Centered percentage overlay */}
        <div className={styles.overlay}>
          <span className={clsx(styles.percentage, styles[variant])}>{clamped.toFixed(0)}%</span>
          <span className={styles.overlayLabel}>{_(msg`used`)}</span>
        </div>
      </div>

      {label && <span className={styles.label}>{label}</span>}

      {showCount && (
        <div className={styles.countRow}>
          <ProgressBar
            value={clamped}
            max={100}
            variant={variant}
            size="sm"
            showLabel={false}
            className={styles.bar}
          />
          <span className={styles.count}>
            {current.toLocaleString()} / {capacity.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
