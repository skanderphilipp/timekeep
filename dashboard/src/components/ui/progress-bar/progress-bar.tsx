import { clsx } from "clsx";

import styles from "./progress-bar.module.scss";

type ProgressBarProps = {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
};

export function ProgressBar({
  value,
  max = 100,
  variant = "default",
  size = "md",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      data-slot="progress-bar"
      className={clsx(styles.wrapper, styles[size], className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div data-slot="progress-bar-track" className={styles.track}>
        <div
          data-slot="progress-bar-fill"
          className={clsx(styles.fill, styles[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span data-slot="progress-bar-label" className={styles.label}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

ProgressBar.displayName = "ProgressBar";
