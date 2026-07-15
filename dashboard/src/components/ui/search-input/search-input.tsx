import { clsx } from "clsx";
import {
  forwardRef,
  type InputHTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useDebouncedCallback } from "use-debounce";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./search-input.module.scss";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** When provided, debounces the onChange callback by this many milliseconds.
   *  The input still shows typed characters immediately for responsive UX. */
  debounceMs?: number;
  style?: React.CSSProperties;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

/**
 * Search input with optional debounced onChange.
 *
 * In immediate mode (no debounceMs), behaves as a fully controlled input —
 * value and onChange are wired directly to the underlying `<input>`.
 *
 * In debounced mode (debounceMs provided), internal state drives the
 * displayed value so typed characters appear instantly, while the parent
 * onChange callback is debounced to avoid excessive fetches. External
 * value changes (e.g. URL navigation, parent reset) are synced into the
 * internal state via useEffect.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    { value, onChange, placeholder, className, debounceMs, style, ...rest },
    ref,
  ) => {
    const { _ } = useLingui();
    const resolvedPlaceholder = placeholder ?? _(msg`Search…`);
    const isDebounced = debounceMs !== undefined;

    // Always called at top level (Rules of Hooks) — only active when debounced.
    const [internalValue, setInternalValue] = useState(value);
    const debouncedOnChange = useDebouncedCallback(onChange, debounceMs ?? 300);

    // Sync external value changes into internal state (e.g. URL nav, parent reset)
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        if (isDebounced) {
          setInternalValue(next);
          debouncedOnChange(next);
        } else {
          onChange(next);
        }
      },
      [isDebounced, debouncedOnChange, onChange],
    );

    const handleClear = useCallback(() => {
      if (isDebounced) setInternalValue("");
      onChange("");
    }, [isDebounced, onChange]);

    const displayValue = isDebounced ? internalValue : value;

    return (
      <div
        data-slot="search-input"
        className={clsx(styles.wrapper, className)}
        style={style}
      >
        <span data-slot="search-input-icon" className={styles.icon}>
          <IconSearch size={16} />
        </span>
        <input
          ref={ref}
          data-slot="search-input-field"
          className={styles.input}
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={resolvedPlaceholder}
          {...rest}
        />
        {displayValue.length > 0 && (
          <button
            data-slot="search-input-clear"
            className={styles.clear}
            onClick={handleClear}
            type="button"
            aria-label={_(msg`Clear search`)}
          >
            <IconX size={14} />
          </button>
        )}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";
