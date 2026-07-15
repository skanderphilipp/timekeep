import { Tag } from "@/components/ui/tag";

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type FilterChipsProps = {
  chips: FilterChip[];
  className?: string;
};

/**
 * Shared filter chip row — rendered identically by `FilterBar` and `FilterDropdown`.
 *
 * Each chip is a dismissible outline `Tag`. Removing a chip calls its `onRemove` callback.
 */
export function FilterChips({ chips, className }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div data-slot="filter-chips" className={className}>
      {chips.map((chip) => (
        <Tag
          key={chip.key}
          text={chip.label}
          color="gray"
          variant="outline"
          dismissible
          onRemove={chip.onRemove}
        />
      ))}
    </div>
  );
}

FilterChips.displayName = "FilterChips";
