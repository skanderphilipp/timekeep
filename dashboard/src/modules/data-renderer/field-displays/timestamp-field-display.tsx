import { Text } from "@/components/ui";
import type { TimestampFieldMetadata } from "../types";

type TimestampFieldDisplayProps = {
  value: number;
  metadata?: TimestampFieldMetadata;
};

/**
 * Timestamp field display — formats a Unix timestamp (seconds) into a
 * human-readable date/time string.
 *
 * Supports format variants: "iso", "relative", "date-only", "time-only".
 */
export function TimestampFieldDisplay({ value, metadata }: TimestampFieldDisplayProps) {
  if (value == null || value === 0) {
    return (
      <Text variant="body" color="tertiary">
        -
      </Text>
    );
  }

  const date = new Date(value * 1000);
  const fmt = metadata?.format ?? "iso";

  let formatted: string;
  switch (fmt) {
    case "relative":
      formatted = formatRelative(date);
      break;
    case "date-only":
      formatted = date.toLocaleDateString();
      break;
    case "time-only":
      formatted = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      break;
    case "iso":
    default:
      formatted = date.toLocaleString();
      break;
  }

  return (
    <Text variant="body" color="primary">
      {formatted}
    </Text>
  );
}

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
