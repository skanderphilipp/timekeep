/**
 * MultiSelect — a multi-value selection dropdown built on @base-ui/react/combobox.
 *
 * Replaces the custom Dropdown-based implementation with base-ui's accessible
 * Combobox primitive in multiple mode. Handles positioning, keyboard navigation,
 * ARIA, search, chip display, and removal automatically.
 */
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { clsx } from "clsx";
import { useState, useMemo, useCallback } from "react";
import { IconCheck } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Spinner } from "@/components/ui/spinner";
import { Tag } from "@/components/ui/tag";

import styles from "./multi-select.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────

export type { MultiSelectOption } from "@/types/options";
import type { MultiSelectOption } from "@/types/options";

type MultiSelectProps = {
  /** Available options to choose from. */
  options: MultiSelectOption[];
  /** Currently selected values (controlled). */
  values: string[];
  /** Called when selection changes. */
  onChange: (values: string[]) => void;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Whether options are loading (async fetch). */
  loading?: boolean;
  /** Message shown when no options match the search. */
  emptyMessage?: string;
  className?: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder,
  searchPlaceholder,
  loading = false,
  emptyMessage,
  className,
}: MultiSelectProps) {
  const { _ } = useLingui();
  const [query, setQuery] = useState("");

  // Selected options as objects
  const selectedOptions = useMemo(
    () => options.filter((o) => values.includes(o.value)),
    [options, values],
  );

  // Filter available options by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const availableOptions = options.filter((o) => !values.includes(o.value));
    if (!q) return availableOptions;
    return availableOptions.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
    );
  }, [options, values, query]);

  // Remove a value
  const removeValue = useCallback(
    (val: string) => {
      onChange(values.filter((v) => v !== val));
    },
    [values, onChange],
  );

  const resolvedPlaceholder = placeholder ?? _(msg`Select…`);
  const resolvedSearchPlaceholder = searchPlaceholder ?? _(msg`Search…`);
  const resolvedEmpty = emptyMessage ?? _(msg`No results found`);

  return (
    <ComboboxPrimitive.Root
      multiple
      value={values}
      onValueChange={(val) => {
        // onValueChange with multiple returns string[]
        if (Array.isArray(val)) onChange(val);
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxPrimitive.Trigger
        data-slot="multi-select-trigger"
        className={clsx(styles.trigger, className)}
        aria-label={resolvedPlaceholder}
      >
        {/* Selected chips */}
        <div data-slot="multi-select-chips" className={styles.chips}>
          {selectedOptions.map((opt) => (
            <Tag
              key={opt.value}
              text={opt.label}
              color="accent"
              variant="solid"
              dismissible
              onRemove={() => removeValue(opt.value)}
            />
          ))}

          {/* Search input within the trigger */}
          <ComboboxPrimitive.Input
            data-slot="multi-select-input"
            className={styles.input}
            placeholder={values.length === 0 ? resolvedPlaceholder : resolvedSearchPlaceholder}
            render={<input type="text" />}
          />
        </div>
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} align="start" className={styles.positioner}>
          <ComboboxPrimitive.Popup data-slot="multi-select-popup" className={styles.popup}>
            <ComboboxPrimitive.List data-slot="multi-select-list" className={styles.list}>
              {loading && (
                <div data-slot="multi-select-loading" className={styles.stateRow}>
                  <Spinner size="sm" />
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <ComboboxPrimitive.Empty data-slot="multi-select-empty" className={styles.stateRow}>
                  <span className={styles.emptyText}>{resolvedEmpty}</span>
                </ComboboxPrimitive.Empty>
              )}

              {!loading &&
                filtered.map((opt) => (
                  <ComboboxPrimitive.Item
                    key={opt.value}
                    data-slot="multi-select-item"
                    value={opt.value}
                    disabled={opt.disabled}
                    className={styles.item}
                  >
                    <span data-slot="multi-select-item-text" className={styles.itemText}>
                      {opt.label}
                    </span>
                    <ComboboxPrimitive.ItemIndicator
                      data-slot="multi-select-item-indicator"
                      className={styles.itemIndicator}
                      render={<IconCheck size={14} aria-hidden="true" />}
                    />
                  </ComboboxPrimitive.Item>
                ))}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
