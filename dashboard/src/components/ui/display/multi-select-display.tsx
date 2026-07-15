import { Tag, type TagColor } from "@/components/ui/tag";

import styles from "./display.module.scss";

type MultiSelectOption = {
  value: string;
  label: string;
  color?: TagColor;
};

type MultiSelectDisplayProps = {
  values: string[];
  options: MultiSelectOption[];
};

/**
 * Read-only multi-select display — renders multiple Tag chips inline.
 *
 * Matches selected values against the options list and renders
 * a chip for each match. Overflow is handled by flex-wrap.
 */
export function MultiSelectDisplay({
  values,
  options,
}: MultiSelectDisplayProps) {
  const selected = options.filter((opt) => values.includes(opt.value));

  if (selected.length === 0) return null;

  return (
    <span data-slot="multi-select-display" className={styles.multiSelectRow}>
      {selected.map((opt) => (
        <Tag
          key={opt.value}
          text={opt.label}
          color={opt.color ?? "accent"}
          variant="solid"
        />
      ))}
    </span>
  );
}
