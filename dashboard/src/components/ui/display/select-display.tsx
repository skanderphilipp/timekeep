import { Tag, type TagColor } from "@/components/ui/tag";
import { EllipsisDisplay } from "./ellipsis-display";

type SelectDisplayProps = {
  color?: TagColor;
  label: string;
};

/**
 * Read-only select display — renders a single Tag chip.
 *
 * Used in table cells and detail views to show enum/select
 * field values as colored chips.
 */
export function SelectDisplay({
  color = "accent",
  label,
}: SelectDisplayProps) {
  return (
    <EllipsisDisplay>
      <Tag text={label} color={color} variant="solid" />
    </EllipsisDisplay>
  );
}
