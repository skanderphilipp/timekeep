/**
 * Combobox — a searchable selection dropdown built on @base-ui/react/combobox.
 *
 * Supports rich option rendering: icons, avatars, status dots, badge counts.
 * Pass `renderOption` for custom markup, or use `prefix`/`suffix` on options
 * for simple icon + count patterns.
 *
 * Built on base-ui's accessible Combobox primitive. Handles positioning,
 * keyboard navigation, ARIA, filtering, loading, and empty states.
 */
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { clsx } from "clsx";
import { useState, useMemo, type ReactNode } from "react";
import { IconCheck } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Spinner } from "@/components/ui/spinner";

import styles from "./combobox.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional icon, avatar, or status indicator rendered before the label. */
  prefix?: ReactNode;
  /** Optional element rendered after the label (e.g., count badge). */
  suffix?: ReactNode;
};

type ComboboxProps = {
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
  className?: string;
};

// ── Default option renderer ──────────────────────────────────────────────────

function DefaultOption({
  option,
  indicator,
}: {
  option: ComboboxOption;
  indicator: ReactNode;
}) {
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
  options,
  value,
  onChange,
  placeholder,
  searchable = true,
  searchPlaceholder,
  loading = false,
  emptyMessage,
  renderOption,
  className,
}: ComboboxProps) {
  const { _ } = useLingui();
  const [query, setQuery] = useState("");

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label;

  // Filter options by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q),
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
    <ComboboxPrimitive.Root
      value={value}
      onValueChange={(val) => {
        if (val !== null) onChange(val);
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        className={clsx(
          styles.trigger,
          !selectedLabel && styles.placeholder,
          className,
        )}
        aria-label={resolvedPlaceholder}
      >
        <ComboboxPrimitive.Value data-slot="combobox-value">
          {selectedOption?.prefix && (
            <span className={styles.triggerPrefix}>{selectedOption.prefix}</span>
          )}
          {selectedLabel ?? resolvedPlaceholder}
        </ComboboxPrimitive.Value>
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          sideOffset={4}
          align="start"
          className={styles.positioner}
        >
          <ComboboxPrimitive.Popup
            data-slot="combobox-popup"
            className={styles.popup}
          >
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

            <ComboboxPrimitive.List
              data-slot="combobox-list"
              className={styles.list}
            >
              {loading && (
                <div data-slot="combobox-loading" className={styles.stateRow}>
                  <Spinner size="sm" />
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <ComboboxPrimitive.Empty
                  data-slot="combobox-empty"
                  className={styles.stateRow}
                >
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
  );
}
