import { clsx } from "clsx";

import styles from "./cells.module.scss";

export type TimestampCellProps = {
  /** ISO 8601 date string or Date object. */
  value: string | Date;
  /** Display format. Defaults to locale-aware short datetime. */
  format?: "datetime" | "date" | "time";
  className?: string;
};

function formatTimestamp(value: string | Date, format: "datetime" | "date" | "time"): string {
  const d = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(d.getTime())) return String(value);

  switch (format) {
    case "date":
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    case "time":
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    case "datetime":
    default:
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  }
}

/**
 * Formatted timestamp cell. Displays dates/times in a consistent,
 * locale-aware format using the browser's Intl API.
 */
export function TimestampCell({ value, format = "datetime", className }: TimestampCellProps) {
  return (
    <time
      dateTime={typeof value === "string" ? value : value.toISOString()}
      className={clsx(styles.timestamp, className)}
    >
      {formatTimestamp(value, format)}
    </time>
  );
}
