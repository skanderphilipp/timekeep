import { clsx } from "clsx";
import { forwardRef, useId, type InputHTMLAttributes } from "react";

import styles from "./toggle.module.scss";

type ToggleProps = {
  label?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, className, id: externalId, disabled, ...rest }, ref) => {
    const autoId = useId();
    const toggleId = externalId || autoId;

    return (
      <label
        data-slot="toggle"
        className={clsx(styles.label, disabled && styles.disabled, className)}
        htmlFor={toggleId}
      >
        <input
          ref={ref}
          id={toggleId}
          data-slot="toggle-input"
          type="checkbox"
          role="switch"
          aria-checked={rest.checked ?? false}
          className={styles.input}
          disabled={disabled}
          {...rest}
        />
        <span data-slot="toggle-track" className={styles.track} aria-hidden="true">
          <span data-slot="toggle-thumb" className={styles.thumb} />
        </span>
        {label && (
          <span data-slot="toggle-label" className={styles.labelText}>
            {label}
          </span>
        )}
      </label>
    );
  },
);

Toggle.displayName = "Toggle";
