import { Tag, type TagColor } from "@/components/ui";

type EnumFieldDisplayProps = {
  value: string;
  labels?: Record<string, string>;
  colors?: Record<string, TagColor>;
  /** Default labels if metadata doesn't provide any. */
  defaultLabels?: Record<string, string>;
  /** Default colors if metadata doesn't provide any. */
  defaultColors?: Record<string, TagColor>;
};

/**
 * Generic enum field display — renders as a colored Tag.
 *
 * Used for `status`, `enum`, and any field with a discrete set of
 * labeled values. Not navigable — use `ReferenceFieldDisplay` for
 * FK fields that navigate to another entity.
 *
 * Precedence: metadata.labels/colors → defaultLabels/defaultColors → raw value / "gray"
 */
export function EnumFieldDisplay({
  value,
  labels,
  colors,
  defaultLabels,
  defaultColors,
}: EnumFieldDisplayProps) {
  const label = labels?.[value] || defaultLabels?.[value] || value;
  const color: TagColor =
    colors?.[value] || defaultColors?.[value] || "gray";

  return <Tag text={label} color={color} variant="solid" />;
}
