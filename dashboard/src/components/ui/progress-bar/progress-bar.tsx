import { clsx } from "clsx";
import { Progress } from "@base-ui/react/progress";

import styles from "./progress-bar.module.scss";

type ProgressBarProps = {
  /** Current value. Pass `undefined` for indeterminate mode. */
  value?: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
};

/**
 * ProgressBar — accessible progress indicator built on @base-ui/react/progress.
 *
 * Pass `value={undefined}` or omit `value` for an indeterminate loading bar
 * with a built-in CSS animation (no custom keyframes needed).
 */
export function ProgressBar({
  value,
  max = 100,
  variant = "default",
  size = "sm",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const pct = value !== undefined ? Math.min(100, Math.max(0, (value / max) * 100)) : undefined;
  const isIndeterminate = value === undefined;

  return (
    <div
      data-slot="progress-bar"
      className={clsx(styles.wrapper, className)}
    >
      <Progress.Root
        value={value ?? null}
        max={max}
        data-slot="progress-bar-root"
        className={clsx(styles.root, styles[size], isIndeterminate && styles.indeterminate)}
      >
        <Progress.Track
          data-slot="progress-bar-track"
          className={clsx(styles.track, variant !== "default" && styles[variant])}
        >
          <Progress.Indicator
            data-slot="progress-bar-indicator"
            className={styles.indicator}
          />
        </Progress.Track>
      </Progress.Root>

      {showLabel && pct !== undefined && (
        <span data-slot="progress-bar-label" className={styles.label}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

ProgressBar.displayName = "ProgressBar";
