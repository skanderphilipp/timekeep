import { Tag, type TagColor } from "@/components/ui";
import { getPunchStatusColor } from "@/lib/punch-status-colors";

type StatusFieldDisplayProps = {
  value: string;
  /** Optional: lookup map for status code → human label. */
  labels?: Record<string, string>;
  /** Optional: color overrides per status code. */
  colors?: Record<string, TagColor>;
};

/**
 * Status field display — renders a colored Tag for status codes.
 *
 * Status color defaults are derived from the shared punch status catalog
 * via `getPunchStatusColor()`. Override via `colors` prop.
 */
export function StatusFieldDisplay({ value, labels, colors }: StatusFieldDisplayProps) {
  const label = labels?.[value] ?? value;
  const color = colors?.[value] ?? getPunchStatusColor(value);

  return <Tag text={label} color={color} variant="solid" />;
}
