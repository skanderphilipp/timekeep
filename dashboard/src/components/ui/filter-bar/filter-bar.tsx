import { clsx } from "clsx";
import { type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { FilterChips, type FilterChip } from "../filter-chips";

import styles from "./filter-bar.module.scss";

export type ActiveFilter = FilterChip;

type FilterBarProps = {
  children: ReactNode;
  /** Search input rendered inline in the toolbar row (constrained width). */
  search?: ReactNode;
  /** Custom actions rendered to the right of the filter controls. */
  actions?: ReactNode;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  activeFilters?: ActiveFilter[];
  resultCount?: number;
  /** Makes the filter bar stick to the top on scroll. */
  sticky?: boolean;
  className?: string;
};

/**
 * Filter bar — single-row toolbar for search, filter controls, count,
 * clear/reset, actions, and active filter chips.
 *
 * All controls render in one horizontal row:
 *
 *   [🔍 Search…] [inline controls]     N results  [✕ Reset] [actions]
 *
 * Active filter chips render in a row below.
 *
 * Inspired by the FilterDropdown toolbar layout but simpler: no popover,
 * just inline controls. Modules with 1-2 simple filters use this directly.
 * Modules with 3+ complex filters use `FilterDropdown`.
 */
export function FilterBar({
  children,
  search,
  actions,
  onClear,
  hasActiveFilters = false,
  activeFilters,
  resultCount,
  sticky = false,
  className,
}: FilterBarProps) {
  const { _ } = useLingui();

  return (
    <div data-slot="filter-bar" className={clsx(styles.root, sticky && styles.sticky, className)}>
      {/* Single-row toolbar */}
      <div className={styles.toolbar}>
        {/* Left side: search + inline controls */}
        <div data-slot="filter-bar-items" className={styles.items}>
          {search && <div className={styles.searchSlot}>{search}</div>}
          {children}
        </div>

        {/* Right side: count + reset + custom actions */}
        <div data-slot="filter-bar-actions" className={styles.actions}>
          {resultCount !== undefined && (
            <span data-slot="filter-bar-count" className={styles.count}>
              {_(msg`{resultCount} results` as any, { resultCount })}
            </span>
          )}
          {onClear && hasActiveFilters && (
            <button
              data-slot="filter-bar-clear"
              className={styles.clear}
              onClick={onClear}
              type="button"
            >
              <IconX size={12} />
              {_(msg`Reset`)}
            </button>
          )}
          {actions}
        </div>
      </div>

      {/* Active filter chips row */}
      <FilterChips chips={activeFilters ?? []} className={styles.chips} />
    </div>
  );
}
