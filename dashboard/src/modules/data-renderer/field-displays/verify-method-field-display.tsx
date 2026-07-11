import { Tag, type TagColor } from "@/components/ui";

type VerifyMethodFieldDisplayProps = {
  value: string;
  labels?: Record<string, string>;
  colors?: Record<string, TagColor>;
};

/** Default display labels per verify mode. */
const DEFAULT_LABELS: Record<string, string> = {
  fingerprint: "Fingerprint",
  face: "Face",
  card: "RF Card",
  password: "Password",
  palm: "Palm",
};

/** Default Tag colors per verify mode. */
const DEFAULT_COLORS: Record<string, TagColor> = {
  fingerprint: "green",
  face: "blue",
  card: "amber",
  password: "gray",
  palm: "accent",
};

/**
 * Verify method field display — renders as a colored Tag.
 */
export function VerifyMethodFieldDisplay({ value, labels, colors }: VerifyMethodFieldDisplayProps) {
  // Resolve label: custom override → default → raw value
  const label = (labels && labels[value]) || DEFAULT_LABELS[value] || value;

  // Resolve color: custom override → default → "gray"
  const color: TagColor = (colors && colors[value]) || DEFAULT_COLORS[value] || "gray";

  return <Tag text={label} color={color} variant="solid" />;
}
