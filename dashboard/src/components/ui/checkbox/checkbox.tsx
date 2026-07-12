import { clsx } from "clsx";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { IconCheck } from "@tabler/icons-react";

import styles from "./checkbox.module.scss";

type CheckboxProps = {
  label?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, id: externalId, disabled, ...rest }, ref) => {
    const autoId = useId();
    const checkboxId = externalId || autoId;

    return (
      <label
        data-slot="checkbox"
        data-disabled={disabled || undefined}
        className={clsx(styles.label, className)}
        htmlFor={checkboxId}
      >
        <input
          ref={ref}
          id={checkboxId}
          data-slot="checkbox-input"
          type="checkbox"
          className={styles.input}
          disabled={disabled}
          {...rest}
        />
        <span data-slot="checkbox-indicator" className={styles.indicator} aria-hidden="true">
          <IconCheck size={14} className={styles.check} />
        </span>
        {label && (
          <span data-slot="checkbox-label" className={styles.labelText}>
            {label}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
