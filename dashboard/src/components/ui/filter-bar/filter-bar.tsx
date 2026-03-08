import { clsx } from "clsx";
import { type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./filter-bar.module.scss";

export type ActiveFilter = {
  key: string;
  label: string;
  onRemove: () => void;
};

type FilterBarProps = {
  children: ReactNode;
  /** Full-width search input rendered above the filter row. */
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
 * Filter bar — the shell that wraps search, filter controls, result count,
 * clear/reset, and active filter chips into one cohesive unit.
 *
 * Use `search` for a prominent search input. Use `children` for inline filter
 * controls. Use `actions` for count/clear/custom controls on the right.
 *
 * The `activeFilters` prop renders removable chips in a row below the bar.
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
    <div
      data-slot="filter-bar"
      className={clsx(styles.root, sticky && styles.sticky, className)}
    >
      {/* Search section — full-width, only rendered when provided */}
      {search && (
        <div data-slot="filter-bar-search" className={styles.search}>
          {search}
        </div>
      )}

      {/* Main bar: filter controls + actions */}
      <div className={styles.bar}>
        <div data-slot="filter-bar-items" className={styles.items}>
          {children}
        </div>

        <div data-slot="filter-bar-actions" className={styles.actions}>
          {resultCount !== undefined && (
            <span data-slot="filter-bar-count" className={styles.count}>
              {_((msg`{resultCount} results`) as any, { resultCount })}
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

      {/* Active filter chips — only render when there are chips to show */}
      {activeFilters && activeFilters.length > 0 && (
        <div data-slot="filter-bar-chips" className={styles.chips}>
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={styles.chip}
              onClick={f.onRemove}
              aria-label={_(msg`Remove ${f.label} filter`)}
            >
              <span className={styles.chipLabel}>{f.label}</span>
              <IconX size={10} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
