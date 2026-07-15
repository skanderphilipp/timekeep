import { formatDisplay } from "@/lib/date";
import { EllipsisDisplay } from "./ellipsis-display";

type DateDisplayProps = {
  value: Date | string | null | undefined;
  dateFormat?: string;
};

/**
 * Read-only date display with locale-aware formatting.
 *
 * Uses `formatDisplay` from `lib/date` which handles
 * single dates, date ranges, and null values gracefully.
 */
export function DateDisplay({
  value,
  dateFormat = "yyyy-MM-dd",
}: DateDisplayProps) {
  const text =
    value instanceof Date
      ? formatDisplay(value, null, "single", dateFormat)
      : typeof value === "string"
        ? value
        : "";

  return <EllipsisDisplay>{text}</EllipsisDisplay>;
}
