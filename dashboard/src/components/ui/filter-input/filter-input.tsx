import { clsx } from "clsx";
import { useState, useEffect, useCallback } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useDebouncedCallback } from "use-debounce";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./filter-input.module.scss";

type FilterInputProps = {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  debounceMs?: number;
  style?: React.CSSProperties;
};

/**
 * Filter input with debounced onChange but UN-debounced keystroke display.
 *
 * Uses internal state so typed characters appear immediately, while the
 * parent onChange callback is debounced to avoid excessive refetches.
 * External value changes (e.g. URL navigation, clear button) are synced
 * into the internal state via useEffect.
 */
export function FilterInput({
  placeholder,
  value,
  onChange,
  className,
  debounceMs = 300,
  style,
}: FilterInputProps) {
  const { _ } = useLingui();
  const resolvedPlaceholder = placeholder ?? _(msg`Search…`);
  const [internalValue, setInternalValue] = useState(value);
  const debouncedOnChange = useDebouncedCallback(onChange, debounceMs);

  // Sync external value changes into internal state (e.g. URL nav, parent reset)
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setInternalValue(next); // immediate keystroke feedback
      debouncedOnChange(next); // debounced API call
    },
    [debouncedOnChange],
  );

  const handleClear = useCallback(() => {
    setInternalValue("");
    onChange(""); // immediate clear, no debounce
  }, [onChange]);

  return (
    <div data-slot="filter-input" className={clsx(styles.wrapper, className)} style={style}>
      <span data-slot="filter-input-icon" className={styles.icon}>
        <IconSearch size={14} />
      </span>
      <input
        data-slot="filter-input-field"
        className={styles.input}
        type="text"
        placeholder={resolvedPlaceholder}
        value={internalValue}
        onChange={handleChange}
      />
      {internalValue.length > 0 && (
        <button
          data-slot="filter-input-clear"
          className={styles.clear}
          onClick={handleClear}
          type="button"
          aria-label={_(msg`Clear`)}
        >
          <IconX size={12} />
        </button>
      )}
    </div>
  );
}
