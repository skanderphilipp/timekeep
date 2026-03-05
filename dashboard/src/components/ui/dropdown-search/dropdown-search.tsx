import { clsx } from "clsx";
import { IconSearch } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./dropdown-search.module.scss";

/**
 * Search input embedded inside a dropdown.
 *
 * Used for filter-as-you-type in command palettes, select menus, and
 * multi-select dropdowns. Keeps focus within the dropdown — pressing
 * Escape closes the parent dropdown, not just the search.
 */
type DropdownSearchProps = {
  /** Placeholder text. */
  placeholder?: string;
  /** Current search value. */
  value: string;
  /** Called when the input value changes. */
  onChange: (value: string) => void;
  /** Called when the clear button is clicked. Sets value to "". */
  onClear?: () => void;
  className?: string;
};

export function DropdownSearch({
  placeholder,
  value,
  onChange,
  onClear,
  className,
}: DropdownSearchProps) {
  const { _ } = useLingui();
  const resolvedPlaceholder = placeholder ?? _(msg`Search…`);
  const showClear = value.length > 0 && onClear;

  return (
    <div data-slot="dropdown-search" className={clsx(styles.search, className)}>
      <span data-slot="dropdown-search-icon" className={styles.icon}>
        <IconSearch size={14} />
      </span>
      <input
        data-slot="dropdown-search-input"
        className={styles.input}
        type="text"
        placeholder={resolvedPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Don't close the dropdown on Escape — let the parent handle it.
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            if (value) {
              onClear?.();
            }
          }
        }}
      />
      {showClear && (
        <button
          data-slot="dropdown-search-clear"
          className={styles.clear}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          type="button"
          aria-label={_(msg`Clear search`)}
        >
          ×
        </button>
      )}
    </div>
  );
}
