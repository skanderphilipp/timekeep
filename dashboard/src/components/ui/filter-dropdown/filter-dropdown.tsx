/**
 * FilterDropdown — "+ Filter" button with a two-step popover for building filters.
 *
 * Designed to be placed inside a `<FilterBar>` toolbar row. FilterBar owns the
 * toolbar layout (search, count, reset, actions, chips); FilterDropdown only
 * provides the filter-building UI.
 *
 * Two-step flow:
 *   1. Click "+ Filter" → choose a field (Device, Status, Date, Anomalies)
 *   2. Set the value using the appropriate control
 *
 * The parent page manages active filter state. When a filter is applied,
 * the value selector's `onApply` is called. The parent updates its filter
 * state, and FilterBar re-renders with new chips via `<FilterChips>`.
 */
import { useState, useCallback, type ReactNode } from "react";
import { clsx } from "clsx";
import { IconFilter, IconArrowLeft } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./filter-dropdown.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────

export type FilterField = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Renders the value selector for this field. Receives `onApply` (close popover) and `onBack` (return to field list). */
  renderValueSelector: (props: { onApply: () => void; onBack: () => void }) => ReactNode;
};

type FilterDropdownProps = {
  /** Available filter fields. */
  fields: FilterField[];
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────

export function FilterDropdown({ fields, className }: FilterDropdownProps) {
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
      <button
        type="button"
        className={styles.filterButton}
        data-open={open}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <IconFilter size={14} />
        <span>{_(msg`Filter`)}</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={handleClose} aria-hidden="true" />
          <div className={styles.popover} role="dialog" aria-label={_(msg`Filter options`)}>
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
    </div>
  );
}

FilterDropdown.displayName = "FilterDropdown";
