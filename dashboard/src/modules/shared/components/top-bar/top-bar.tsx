import { clsx } from "clsx";
import { type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./top-bar.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────

export type TopBarProps = {
  /** Left slot — typically a ViewPicker or breadcrumb. */
  left?: ReactNode;
  /** Center slot — typically a SearchInput. Expands to fill available space. */
  center?: ReactNode;
  /** Right slot — typically FilterDropdown, SortDropdown, actions. */
  right?: ReactNode;
  /** Bottom slot — active filter/sort chips. Hidden when empty. */
  bottom?: ReactNode;
  /** Result count displayed next to the reset button. */
  resultCount?: number;
  /** Whether any filters are active (shows reset button). */
  hasActiveFilters?: boolean;
  /** Called when the reset button is clicked. */
  onClear?: () => void;
  /** Makes the top bar sticky on scroll. */
  sticky?: boolean;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * TopBar — generic list page toolbar with view switching, search, filters, and chips.
 *
 * Three-slot layout (left | center | right) with an optional bottom chips row.
 * Inspired by Twenty's ViewBar / TopBar pattern.
 *
 * ```tsx
 * <TopBar
 *   left={<ViewPicker />}
 *   center={<SearchInput ... />}
 *   right={<FilterDropdown ... />}
 *   bottom={<FilterChips ... />}
 *   resultCount={42}
 *   hasActiveFilters={hasActive}
 *   onClear={handleClear}
 * />
 * ```
 */
export function TopBar({
  left,
  center,
  right,
  bottom,
  resultCount,
  hasActiveFilters = false,
  onClear,
  sticky = false,
  className,
}: TopBarProps) {
  const { _ } = useLingui();

  return (
    <div data-slot="top-bar" className={clsx(styles.root, sticky && styles.sticky, className)}>
      {/* Top row: three slots */}
      <div className={styles.topRow}>
        {left && <div className={styles.left}>{left}</div>}
        {center && <div className={styles.center}>{center}</div>}
        <div className={styles.right}>
          {resultCount !== undefined && (
            <span data-slot="top-bar-count" className={styles.count}>
              {_(msg`{resultCount} results` as any, { resultCount })}
            </span>
          )}
          {onClear && hasActiveFilters && (
            <button
              data-slot="top-bar-clear"
              className={styles.clear}
              onClick={onClear}
              type="button"
            >
              <IconX size={12} />
              {_(msg`Reset`)}
            </button>
          )}
          {right}
        </div>
      </div>

      {/* Bottom row: chips (hidden when empty) */}
      {bottom && <div className={styles.bottomRow}>{bottom}</div>}
    </div>
  );
}

TopBar.displayName = "TopBar";
