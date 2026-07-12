import { IconArrowsSort } from "@tabler/icons-react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Tag } from "@/components/ui/tag";

import styles from "./view-bar.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ViewType = "table" | "calendar" | "timeline";

export type FilterChip = {
  id: string;
  label: string;
  value: string;
  icon?: TablerIcon;
};

export type SortChip = {
  id: string;
  label: string;
  value: string;
  icon?: TablerIcon;
};

export type ViewBarProps = {
  /** Currently active view type. */
  viewType: ViewType;
  /** Called when the view type changes. */
  onViewTypeChange: (type: ViewType) => void;
  /** Active filter chips. */
  filters?: FilterChip[];
  /** Called when a filter chip is removed. */
  onRemoveFilter?: (id: string) => void;
  /** Called when the "Add Filter" button is clicked. */
  onAddFilter?: () => void;
  /** Active sort chips. */
  sorts?: SortChip[];
  /** Called when a sort chip is removed. */
  onRemoveSort?: (id: string) => void;
  /** Called when the "Add Sort" button is clicked. */
  onAddSort?: () => void;
  /** Total record count (shown next to view name). */
  totalCount?: number;
  className?: string;
};

// ── View Type Switcher ─────────────────────────────────────────────────────────

const VIEW_TYPES: ViewType[] = ["table", "calendar", "timeline"];

function ViewTypeSwitcher({
  active,
  onChange,
  labels,
}: {
  active: ViewType;
  onChange: (t: ViewType) => void;
  labels: Record<ViewType, string>;
}) {
  return (
    <div data-slot="view-type-switcher" className={styles.switcher}>
      {VIEW_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          data-active={type === active ? "" : undefined}
          className={clsx(styles.switcherButton, type === active && styles.switcherActive)}
          onClick={() => onChange(type)}
        >
          {labels[type]}
        </button>
      ))}
    </div>
  );
}

// ── Chip Row ───────────────────────────────────────────────────────────────────

function ChipRow({
  filters,
  sorts,
  onRemoveFilter,
  onRemoveSort,
  onAddFilter,
  onAddSort,
  _,
}: {
  filters?: FilterChip[];
  sorts?: SortChip[];
  onRemoveFilter?: (id: string) => void;
  onRemoveSort?: (id: string) => void;
  onAddFilter?: () => void;
  onAddSort?: () => void;
  _: ReturnType<typeof useLingui>["_"];
}) {
  const hasFilters = filters && filters.length > 0;
  const hasSorts = sorts && sorts.length > 0;

  return (
    <div data-slot="view-bar-chips" className={styles.chipRow}>
      <div className={styles.chipContainer}>
        {/* Sort chips */}
        {hasSorts &&
          sorts.map((sort) => (
            <Tag
              key={`sort-${sort.id}`}
              text={sort.label}
              value={sort.value}
              Icon={sort.icon ?? IconArrowsSort}
              color="blue"
              variant="solid"
              dismissible
              onRemove={() => onRemoveSort?.(sort.id)}
            />
          ))}

        {/* Separator between sort and filter chips */}
        {hasSorts && hasFilters && <span className={styles.separator} />}

        {/* Filter chips */}
        {hasFilters &&
          filters.map((filter) => (
            <Tag
              key={`filter-${filter.id}`}
              text={filter.label}
              value={filter.value}
              color="amber"
              variant="solid"
              dismissible
              onRemove={() => onRemoveFilter?.(filter.id)}
            />
          ))}
      </div>

      {/* Action buttons */}
      <div className={styles.chipActions}>
        {onAddSort && (
          <button type="button" className={styles.addButton} onClick={onAddSort}>
            {_(msg`+ Sort`)}
          </button>
        )}
        {onAddFilter && (
          <button type="button" className={styles.addButton} onClick={onAddFilter}>
            {_(msg`+ Filter`)}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ViewBar({
  viewType,
  onViewTypeChange,
  filters,
  sorts,
  onRemoveFilter,
  onRemoveSort,
  onAddFilter,
  onAddSort,
  totalCount,
  className,
}: ViewBarProps) {
  const { _ } = useLingui();
  const hasChips = (filters && filters.length > 0) || (sorts && sorts.length > 0);

  const viewTypeLabels: Record<ViewType, string> = {
    table: _(msg`Table`),
    calendar: _(msg`Calendar`),
    timeline: _(msg`Timeline`),
  };

  return (
    <div data-slot="view-bar" className={clsx(styles.root, className)}>
      {/* Top bar: view type switcher + count */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <ViewTypeSwitcher active={viewType} onChange={onViewTypeChange} labels={viewTypeLabels} />
          {totalCount !== undefined && (
            <span className={styles.count}>
              {totalCount.toLocaleString()} {_(msg`records`)}
            </span>
          )}
        </div>
      </div>

      {/* Bottom: chips row (only when there are active filters/sorts) */}
      {hasChips && (
        <ChipRow
          filters={filters}
          sorts={sorts}
          onRemoveFilter={onRemoveFilter}
          onRemoveSort={onRemoveSort}
          onAddFilter={onAddFilter}
          onAddSort={onAddSort}
          _={_}
        />
      )}
    </div>
  );
}
