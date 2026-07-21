import { clsx } from "clsx";
import { forwardRef, useId } from "react";
import { Switch as BaseUISwitch } from "@base-ui/react/switch";

import styles from "./switch.module.scss";

type SwitchProps = {
  /** Field label rendered above the toggle (form-level label). */
  fieldLabel?: string;
  /** Inline text next to the toggle. */
  label?: string;
  /** Validation error message. */
  error?: string;
  /** Helper text shown when no error. */
  helperText?: string;
  /** Mark as required (shows asterisk on field label). */
  required?: boolean;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  readOnly?: boolean;
  id?: string;
  /**
   * Override the root `data-slot` attribute for E2E test selectors.
   * Defaults to `"switch"`. Use a unique value when multiple
   * switches appear on the same page (e.g., `"anomaly-toggle"`).
   */
  dataSlot?: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      fieldLabel,
      label,
      error,
      helperText,
      required = false,
      className,
      disabled,
      checked,
      defaultChecked,
      onCheckedChange,
      name,
      value,
      readOnly,
      id: externalId,
      dataSlot,
    },
    ref,
  ) => {
    const autoId = useId();
    const controlId = externalId ?? autoId;
    const errorId = `${controlId}-error`;
    const helperId = `${controlId}-helper`;

    const switchElement = (
      <BaseUISwitch.Root
        inputRef={ref}
        data-slot={dataSlot ?? "switch"}
        className={clsx(styles.root, className)}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        name={name}
        value={value}
        required={required}
        readOnly={readOnly}
        id={controlId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
      >
        <BaseUISwitch.Thumb data-slot="switch-thumb" className={styles.thumb} />
      </BaseUISwitch.Root>
    );

    const toggleRow = label ? (
      <label className={clsx(styles.toggleLabel, disabled && styles.disabled)}>
        {switchElement}
        <span data-slot="switch-label" className={styles.labelText}>
          {label}
        </span>
      </label>
    ) : (
      switchElement
    );

    return (
      <div data-slot="switch-container" className={styles.container}>
        {fieldLabel && (
          <span data-slot="switch-field-label" className={styles.fieldLabel}>
            {fieldLabel}
            {required && <span className={styles.required}>*</span>}
          </span>
        )}

        {toggleRow}

        {error && (
          <p data-slot="switch-error" id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p data-slot="switch-helper" id={helperId} className={styles.helper}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Switch.displayName = "Switch";
