import { clsx } from "clsx";
import { forwardRef, useId } from "react";

import { DEFAULT_ZKTECO_PORT, MIN_PORT, MAX_PORT } from "@/lib/constants";
import styles from "./port-input.module.scss";

type PortInputProps = {
  label?: string;
  error?: string;
  helperText?: string;
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (value: number) => void;
  onRawChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  name?: string;
};

/**
 * A port number input (1–65535).
 *
 * Strips non-numeric input and clamps values to the valid port range
 * on blur. Use with react-hook-form's `register("port", { valueAsNumber: true })`
 * or as a standalone controlled input via `value` + `onChange`.
 */
export const PortInput = forwardRef<HTMLInputElement, PortInputProps>(
  (
    {
      label,
      error,
      helperText,
      value,
      defaultValue,
      onChange,
      onRawChange,
      placeholder = String(DEFAULT_ZKTECO_PORT),
      disabled = false,
      required = false,
      fullWidth = false,
      className,
      id: externalId,
      name,
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = externalId || autoId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Strip non-digits
      const cleaned = raw.replace(/\D/g, "");
      onRawChange?.(cleaned);

      const num = Number.parseInt(cleaned, 10);
      if (!Number.isNaN(num) && num >= 0) {
        onChange?.(num);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const cleaned = raw.replace(/\D/g, "");
      const num = Number.parseInt(cleaned, 10);
      if (!Number.isNaN(num)) {
        const clamped = Math.min(MAX_PORT, Math.max(MIN_PORT, num));
        if (clamped !== num) {
          onChange?.(clamped);
        }
      }
    };

    return (
      <div
        data-slot="port-input"
        className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
      >
        {label && (
          <label data-slot="port-input-label" className={styles.label} htmlFor={inputId}>
            {label}
            {required && (
              <span data-slot="port-input-required" className={styles.required}>
                *
              </span>
            )}
          </label>
        )}

        <div data-slot="port-input-wrapper" className={styles.inputWrapper}>
          <input
            ref={ref}
            id={inputId}
            name={name}
            data-slot="port-input-field"
            className={clsx(styles.input, error && styles.inputError)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>

        {error && (
          <p data-slot="port-input-error" id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p data-slot="port-input-helper" id={helperId} className={styles.helper}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

PortInput.displayName = "PortInput";

/** Clamp a number to valid port range. */
export function clampPort(value: number): number {
  return Math.min(MAX_PORT, Math.max(MIN_PORT, value));
}
