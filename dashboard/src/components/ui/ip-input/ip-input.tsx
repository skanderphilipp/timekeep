import { clsx } from "clsx";
import { useId } from "react";
import { useIMask } from "react-imask";

import styles from "./ip-input.module.scss";

/**
 * IPv4 address validation regex.
 * Accepts values between 0.0.0.0 and 255.255.255.255.
 * Leading zeros are NOT allowed (e.g., "192.168.001.001" is rejected).
 */
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

type IpInputProps = {
  /** Label text (optional — prefer FormField for labels). */
  label?: string;
  /** Validation error message. */
  error?: string;
  /** Helper text shown below the input (only when no error). */
  helperText?: string;
  /** Default/initial value (uncontrolled). */
  defaultValue?: string;
  /** Called when the user enters a complete, valid IP. */
  onChange?: (value: string) => void;
  /** Called on every keystroke (even incomplete). */
  onRawChange?: (value: string) => void;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Disable the input. */
  disabled?: boolean;
  /** Mark as required. */
  required?: boolean;
  /** Expand to full container width. */
  fullWidth?: boolean;
  /** CSS class. */
  className?: string;
  /** HTML id attribute (auto-generated if omitted). */
  id?: string;
  /** Name attribute for form submission. */
  name?: string;
};

/**
 * IPv4 address input with mask enforcement.
 *
 * Uses `react-imask` to restrict input to dotted decimal format (0-255 per octet).
 * Calls `onChange` only when a complete, valid IPv4 address is entered.
 */
export function IpInput({
  label,
  error,
  helperText,
  defaultValue,
  onChange,
  onRawChange,
  placeholder = "192.168.1.100",
  disabled = false,
  required = false,
  fullWidth = false,
  className,
  id: externalId,
  name,
}: IpInputProps) {
  const autoId = useId();
  const inputId = externalId || autoId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // IMask for IPv4 dotted decimal format
  const { ref } = useIMask(
    {
      mask: "0[0][0].0[0][0].0[0][0].0[0][0]",
      definitions: { "0": /[0-9]/ },
    },
    {
      onAccept: (_value, mask) => {
        const raw = mask.unmaskedValue;
        onRawChange?.(raw);

        if (raw.length > 0 && IPV4_REGEX.test(raw)) {
          onChange?.(raw);
        }
      },
    },
  );

  return (
    <div
      data-slot="ip-input"
      className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
    >
      {label && (
        <label data-slot="ip-input-label" className={styles.label} htmlFor={inputId}>
          {label}
          {required && <span data-slot="ip-input-required" className={styles.required}>*</span>}
        </label>
      )}

      <div data-slot="ip-input-wrapper" className={styles.inputWrapper}>
        <input
          ref={(node) => {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          id={inputId}
          name={name}
          data-slot="ip-input-field"
          className={clsx(styles.input, error && styles.inputError)}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          defaultValue={defaultValue}
        />
      </div>

      {error && (
        <p data-slot="ip-input-error" id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p data-slot="ip-input-helper" id={helperId} className={styles.helper}>
          {helperText}
        </p>
      )}
    </div>
  );
}

/** Check if a string is a valid IPv4 address. */
export function isValidIpv4(value: string): boolean {
  return IPV4_REGEX.test(value);
}
