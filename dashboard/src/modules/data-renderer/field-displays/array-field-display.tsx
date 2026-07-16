import { Tag, Text, type TagColor } from "@/components/ui";
import type { ArrayFieldMetadata } from "../types";

type ArrayFieldDisplayProps = {
  value: unknown;
  metadata?: ArrayFieldMetadata;
};

/**
 * Array field display — renders array items as inline Tag chips.
 *
 * Supports:
 * - `boolean[]` → labels/colors from metadata (e.g., working_days: [true, false, true])
 * - `string[]`  → each item as a Tag (optionally labeled via metadata)
 * - `number[]`  → each item as a Tag
 *
 * @example
 * // working_days: [true, true, true, true, true, false, false]
 * <ArrayFieldDisplay
 *   value={[true, true, true, true, true, false, false]}
 *   metadata={{
 *     fieldName: "working_days",
 *     positionLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
 *     colors: { active: "green", inactive: "gray" },
 *   }}
 * />
 */
export function ArrayFieldDisplay({ value, metadata }: ArrayFieldDisplayProps) {
  if (value == null) {
    return (
      <Text variant="body" color="tertiary">
        -
      </Text>
    );
  }

  if (!Array.isArray(value)) {
    return (
      <Text variant="body" color="primary">
        {String(value)}
      </Text>
    );
  }

  if (value.length === 0) {
    return (
      <Text variant="body" color="tertiary">
        -
      </Text>
    );
  }

  const labels = metadata?.labels;
  const colors = metadata?.colors;
  const positionLabels = metadata?.positionLabels;

  return (
    <span data-slot="array-field-display" style={{ display: "flex", gap: "var(--ao-spacing-1)", flexWrap: "wrap" }}>
      {value.map((item, index) => {
        // Position-based labels take precedence (e.g., working_days index → day name)
        const posLabel = positionLabels?.[index];

        if (posLabel) {
          // Use boolean value at this position to determine color
          const isActive = Boolean(item);
          const color: TagColor = isActive ? "green" : "gray";
          return (
            <Tag key={`${posLabel}-${index}`} text={posLabel} color={color} variant="solid" />
          );
        }

        const key = String(item);
        const label = labels?.[key] ?? key;
        const color: TagColor = colors?.[key] ?? "gray";

        return (
          <Tag key={`${key}-${index}`} text={label} color={color} variant="solid" />
        );
      })}
    </span>
  );
}
