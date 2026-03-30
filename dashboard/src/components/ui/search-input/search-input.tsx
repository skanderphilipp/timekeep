import { clsx } from "clsx";
import { forwardRef, type InputHTMLAttributes, useCallback } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./search-input.module.scss";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder, className, ...rest }, ref) => {
    const { _ } = useLingui();
    const resolvedPlaceholder = placeholder ?? _(msg`Search…`);
    const handleClear = useCallback(() => onChange(""), [onChange]);

    return (
      <div data-slot="search-input" className={clsx(styles.wrapper, className)}>
        <span data-slot="search-input-icon" className={styles.icon}>
          <IconSearch size={16} />
        </span>
        <input
          ref={ref}
          data-slot="search-input-field"
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          {...rest}
        />
        {value.length > 0 && (
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
