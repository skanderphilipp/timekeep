import { Tag, type TagColor } from "@/components/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

type DirectionFieldDisplayProps = {
  value: string;
  /** Optional: override the default "IN" / "OUT" labels. */
  labels?: { in: string; out: string };
};

/**
 * Direction field display — renders "IN" (green) or "OUT" (red) Tags.
 */
export function DirectionFieldDisplay({ value, labels }: DirectionFieldDisplayProps) {
  const { _ } = useLingui();
  const normalized = value.toUpperCase();
  const isIn = normalized.includes("IN") && !normalized.includes("OUT");

  const text = isIn ? (labels?.in ?? _(msg`IN`)) : (labels?.out ?? _(msg`OUT`));
  const color: TagColor = isIn ? "green" : "red";

  return <Tag text={text} color={color} variant="solid" />;
}
