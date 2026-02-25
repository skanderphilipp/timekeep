import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "./circular-progress-bar.module.scss";

export type CircularProgressBarProps = {
  /** Diameter in pixels. Defaults to 50. */
  size?: number;
  /** Stroke width in pixels. Defaults to 5. */
  barWidth?: number;
  /** Stroke color. Defaults to currentColor. */
  barColor?: string;
};

/**
 * 1:1 port of Reaktly's CircularProgressBar.
 *
 * Animated indeterminate SVG spinner using stroke-dasharray
 * and rotation keyframes. For determinate progress, use the
 * linear ProgressBar component.
 */
export function CircularProgressBar({
  size = 50,
  barWidth = 5,
  barColor = "currentColor",
}: CircularProgressBarProps) {
  const { _ } = useLingui();
  return (
    <svg
      data-slot="circular-progress-bar"
      className={styles.svg}
      width={size}
      height={size}
      aria-label={_(msg`Loading`)}
      role="progressbar"
    >
      <circle
        className={styles.circle}
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - barWidth}
        fill="none"
        stroke={barColor}
        strokeWidth={barWidth}
        strokeLinecap="round"
        pathLength={100}
      />
    </svg>
  );
}
