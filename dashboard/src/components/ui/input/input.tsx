import { clsx } from "clsx";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import styles from "./input.module.scss";

type InputProps = {
  label?: string;
  error?: string;
  helperText?: string;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
  fullWidth?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftAdornment,
      rightAdornment,
      fullWidth = false,
      className,
      id: externalId,
      disabled,
      required,
      ...rest
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = externalId || autoId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div
        data-slot="input"
        className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
      >
        {label && (
          <label data-slot="input-label" className={styles.label} htmlFor={inputId}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div data-slot="input-wrapper" className={styles.inputWrapper}>
          {leftAdornment && (
            <span data-slot="input-adornment-left" className={styles.adornment}>
              {leftAdornment}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            data-slot="input-field"
            className={clsx(
              styles.input,
              error && styles.inputError,
              leftAdornment && styles.hasLeftAdornment,
              rightAdornment && styles.hasRightAdornment,
            )}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            {...rest}
          />

          {rightAdornment && (
            <span data-slot="input-adornment-right" className={styles.adornment}>
              {rightAdornment}
            </span>
          )}
        </div>

        {error && (
          <p data-slot="input-error" id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p data-slot="input-helper" id={helperId} className={styles.helper}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
