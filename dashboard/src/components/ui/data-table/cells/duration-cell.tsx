import { clsx } from "clsx";

import styles from "./cells.module.scss";

export type DurationCellProps = {
  /** Duration in minutes. */
  minutes: number;
  /** Show as hours:minutes (true) or raw minutes (false). */
  humanized?: boolean;
  className?: string;
};

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 0) return `-${formatDuration(-totalMinutes)}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Duration cell. Displays time durations in a human-readable format
 * (e.g., "8h 30m" or "510m").
 */
export function DurationCell({ minutes, humanized = true, className }: DurationCellProps) {
  const display = humanized ? formatDuration(minutes) : `${minutes}m`;

  return <span className={clsx(styles.duration, className)}>{display}</span>;
}
