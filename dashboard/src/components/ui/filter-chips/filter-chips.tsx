import { Tag } from "@/components/ui/tag";
import type { TagColor } from "@/components/ui/tag";
import styles from "./filter-chips.module.scss";
import { clsx } from "clsx";

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
  /** Semantic color for the chip. Defaults to "gray" if unset. */
  color?: TagColor;
};

type FilterChipsProps = {
  chips: FilterChip[];
  className?: string;
};

/**
 * Shared filter chip row — rendered identically by `FilterBar` and `FilterDropdown`.
 *
 * Each chip is a dismissible solid `Tag` with semantic color.
 * Chips are laid out in a flex row with spacing so they don't touch.
 */
export function FilterChips({ chips, className }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div data-slot="filter-chips" className={clsx(styles.row, className)}>
      {chips.map((chip) => (
        <Tag
          key={chip.key}
          text={chip.label}
          color={chip.color ?? "gray"}
          variant="solid"
          weight="medium"
          dismissible
          onRemove={chip.onRemove}
        />
      ))}
    </div>
  );
}

FilterChips.displayName = "FilterChips";
