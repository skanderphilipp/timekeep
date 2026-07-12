/**
 * FilterDropdown — Twenty/Linear-style filter button + popover.
 *
 * Replaces the multi-line FilterBar with a compact single-row pattern:
 *   [+ Filter] [✕ Reset]              N results [Columns ▾]
 *   [chip] [chip]
 *
 * Two-step flow:
 *   1. Click "+ Filter" → choose a field (Device, Status, Date, Anomalies)
 *   2. Set the value using the appropriate control
 *
 * Active filters shown as removable chips below.
 */
import { useState, useCallback, type ReactNode } from "react";
import { clsx } from "clsx";
import { IconFilter, IconX, IconArrowLeft } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Tag } from "@/components/ui/tag";

import styles from "./filter-dropdown.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

export type FilterField = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Renders the value selector for this field. */
  renderValueSelector: (props: { onApply: () => void; onBack: () => void }) => ReactNode;
};

type FilterDropdownProps = {
  fields: FilterField[];
  activeFilters?: FilterChip[];
  resultCount?: number;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  actions?: ReactNode;
  className?: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export function FilterDropdown({
  fields,
  activeFilters,
  resultCount,
  hasActiveFilters = false,
  onClear,
  actions,
  className,
}: FilterDropdownProps) {
  const { _ } = useLingui();
  const [open, setOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FilterField | null>(null);

  const handleSelectField = useCallback((field: FilterField) => {
    setSelectedField(field);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedField(null);
  }, []);

  const handleApply = useCallback(() => {
    setOpen(false);
    setSelectedField(null);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSelectedField(null);
  }, []);

  return (
    <div className={clsx(styles.root, className)}>
      {/* Toolbar row */}
      <div className={styles.toolbar}>
        <div className={styles.filterArea}>
          <button
            type="button"
            className={clsx(styles.filterButton, open && styles.filterButtonOpen)}
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <IconFilter size={14} />
            <span>{_(msg`Filter`)}</span>
          </button>

          {hasActiveFilters && onClear && (
            <button type="button" className={styles.resetButton} onClick={onClear}>
              <IconX size={12} />
              <span>{_(msg`Reset`)}</span>
            </button>
          )}
        </div>

        <div className={styles.actions}>
          {resultCount !== undefined && (
            <span className={styles.count}>
              {_(msg`{resultCount} results` as any, { resultCount })}
            </span>
          )}
          {actions}
        </div>
      </div>

      {/* Popover */}
      {open && (
        <>
          <div className={styles.backdrop} onClick={handleClose} aria-hidden="true" />
          <div className={styles.popover} role="dialog">
            {selectedField ? (
              /* Step 2: Value selector for chosen field */
              <div className={styles.valuePanel}>
                <button type="button" className={styles.backButton} onClick={handleBack}>
                  <IconArrowLeft size={14} />
                  <span>{selectedField.label}</span>
                </button>
                <div className={styles.valueContent}>
                  {selectedField.renderValueSelector({
                    onApply: handleApply,
                    onBack: handleBack,
                  })}
                </div>
              </div>
            ) : (
              /* Step 1: Choose a field */
              <div className={styles.fieldList}>
                <div className={styles.fieldListHeader}>{_(msg`Filter by`)}</div>
                {fields.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    className={styles.fieldItem}
                    onClick={() => handleSelectField(field)}
                  >
                    {field.icon && <span className={styles.fieldIcon}>{field.icon}</span>}
                    <span className={styles.fieldLabel}>{field.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Active filter chips */}
      {activeFilters && activeFilters.length > 0 && (
        <div className={styles.chips}>
          {activeFilters.map((chip) => (
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
      )}
    </div>
  );
}
