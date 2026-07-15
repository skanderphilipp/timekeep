/**
 * Combobox — a searchable selection dropdown built on @base-ui/react/combobox.
 *
 * Self-contained form control: handles its own label, error, helper text,
 * search/filter, loading, and empty states. Twenty-aligned — no FormField
 * wrapper needed.
 *
 * Supports rich option rendering: icons, avatars, status dots, badge counts.
 * Pass `renderOption` for custom markup, or use `prefix`/`suffix` on options
 * for simple icon + count patterns.
 */
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { clsx } from "clsx";
import { useState, useMemo, useId, type ReactNode } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Spinner } from "@/components/ui/spinner";

import styles from "./combobox.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────

export type { ComboboxOption } from "@/types/options";
import type { ComboboxOption } from "@/types/options";

type ComboboxProps = {
  /** Accessible label rendered above the control. */
  label?: string;
  /** Validation error message. */
  error?: string;
  /** Helper text shown when no error. */
  helperText?: string;
  /** Mark as required (shows asterisk). */
  required?: boolean;
  /** Expand to full container width. */
  fullWidth?: boolean;
  /** Available options to choose from. */
  options: ComboboxOption[];
  /** Currently selected value (controlled). */
  value: string | undefined;
  /** Called when user selects an option. */
  onChange: (value: string) => void;
  /** Placeholder text when nothing is selected. */
  placeholder?: string;
  /** When true, enables the built-in search/filter input. */
  searchable?: boolean;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Whether options are loading (async fetch). */
  loading?: boolean;
  /** Message shown when no options match the search. */
  emptyMessage?: string;
  /**
   * Fully custom option renderer. Receives the option object and the
   * default item indicator (checkmark). Return any ReactNode.
   *
   * When provided, `option.prefix` and `option.suffix` are ignored —
   * you control the entire item layout.
   */
  renderOption?: (option: ComboboxOption, checkIndicator: ReactNode) => ReactNode;
  /** Disable the control. */
  disabled?: boolean;
  className?: string;
  /** HTML id (auto-generated if omitted). */
  id?: string;
};

// ── Default option renderer ──────────────────────────────────────────────────

function DefaultOption({ option, indicator }: { option: ComboboxOption; indicator: ReactNode }) {
  return (
    <>
      {option.prefix && (
        <span data-slot="combobox-item-prefix" className={styles.itemPrefix}>
          {option.prefix}
        </span>
      )}
      <span data-slot="combobox-item-text" className={styles.itemText}>
        {option.label}
      </span>
      {option.suffix && (
        <span data-slot="combobox-item-suffix" className={styles.itemSuffix}>
          {option.suffix}
        </span>
      )}
      {indicator}
    </>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function Combobox({
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  options,
  value,
  onChange,
  placeholder,
  searchable = true,
  searchPlaceholder,
  loading = false,
  emptyMessage,
  renderOption,
  disabled = false,
  className,
  id: externalId,
}: ComboboxProps) {
  const { _ } = useLingui();
  const autoId = useId();
  const controlId = externalId ?? autoId;
  const errorId = `${controlId}-error`;
  const helperId = `${controlId}-helper`;
  const [query, setQuery] = useState("");

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label;

  // Filter options by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const resolvedPlaceholder = placeholder ?? _(msg`Select…`);
  const resolvedSearchPlaceholder = searchPlaceholder ?? _(msg`Search…`);
  const resolvedEmpty = emptyMessage ?? _(msg`No results found`);

  const checkIndicator = (
    <ComboboxPrimitive.ItemIndicator
      data-slot="combobox-item-indicator"
      className={styles.itemIndicator}
      render={<IconCheck size={14} aria-hidden="true" />}
    />
  );

  return (
    <div
      data-slot="combobox"
      className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
    >
      {label && (
        <label data-slot="combobox-label" className={styles.label} htmlFor={controlId}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}

      <div data-slot="combobox-wrapper">
        <ComboboxPrimitive.Root
          value={value}
          onValueChange={(val) => {
            if (val !== null) onChange(val);
          }}
          inputValue={query}
          onInputValueChange={setQuery}
          disabled={disabled}
        >
          <ComboboxPrimitive.Trigger
            id={controlId}
            data-slot="combobox-trigger"
            className={clsx(
              styles.trigger,
              !selectedLabel && styles.placeholder,
              error && styles.triggerError,
            )}
            aria-label={resolvedPlaceholder}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
          >
            <ComboboxPrimitive.Value data-slot="combobox-value">
              {selectedOption?.prefix && (
                <span className={styles.triggerPrefix}>{selectedOption.prefix}</span>
              )}
              {selectedLabel ?? resolvedPlaceholder}
            </ComboboxPrimitive.Value>
            <IconChevronDown
              data-slot="combobox-chevron"
              className={styles.chevron}
              size={14}
              aria-hidden="true"
            />
          </ComboboxPrimitive.Trigger>

          <ComboboxPrimitive.Portal>
            <ComboboxPrimitive.Positioner sideOffset={4} align="start" className={styles.positioner}>
              <ComboboxPrimitive.Popup data-slot="combobox-popup" className={styles.popup}>
                {searchable && (
                  <div data-slot="combobox-search-wrapper" className={styles.searchWrapper}>
                    <ComboboxPrimitive.Input
                      data-slot="combobox-input"
                      className={styles.input}
                      placeholder={resolvedSearchPlaceholder}
                      render={<input type="text" />}
                    />
                  </div>
                )}

                <ComboboxPrimitive.List data-slot="combobox-list" className={styles.list}>
                  {loading && (
                    <div data-slot="combobox-loading" className={styles.stateRow}>
                      <Spinner size="sm" />
                    </div>
                  )}

                  {!loading && filtered.length === 0 && (
                    <ComboboxPrimitive.Empty data-slot="combobox-empty" className={styles.stateRow}>
                      <span className={styles.emptyText}>{resolvedEmpty}</span>
                    </ComboboxPrimitive.Empty>
                  )}

                  {!loading &&
                    filtered.map((opt) => (
                      <ComboboxPrimitive.Item
                        key={opt.value}
                        data-slot="combobox-item"
                        value={opt.value}
                        disabled={opt.disabled}
                        className={styles.item}
                      >
                        {renderOption ? (
                          renderOption(opt, checkIndicator)
                        ) : (
                          <DefaultOption option={opt} indicator={checkIndicator} />
                        )}
                      </ComboboxPrimitive.Item>
                    ))}
                </ComboboxPrimitive.List>
              </ComboboxPrimitive.Popup>
            </ComboboxPrimitive.Positioner>
          </ComboboxPrimitive.Portal>
        </ComboboxPrimitive.Root>
      </div>

      {error && (
        <p data-slot="combobox-error" id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p data-slot="combobox-helper" id={helperId} className={styles.helper}>
          {helperText}
        </p>
      )}
    </div>
  );
}
