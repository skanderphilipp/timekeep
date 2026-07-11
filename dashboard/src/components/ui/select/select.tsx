/**
 * Select — a styled selection dropdown built on @base-ui/react/select.
 *
 * Replaces the native `<select>`-based component with base-ui's accessible
 * Select primitive. Handles positioning, keyboard navigation, ARIA, and
 * form integration automatically.
 */
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { clsx } from "clsx";
import { forwardRef, useId } from "react";
import { IconSelector, IconCheck } from "@tabler/icons-react";

import styles from "./select.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────────

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  /** Accessible label for the select (rendered as a `<label>`). */
  label?: string;
  /** Error message — shown below the trigger in red. */
  error?: string;
  /** Helper text — shown below the trigger when no error. */
  helperText?: string;
  /** Available options. */
  options: SelectOption[];
  /** Placeholder shown when no value is selected. */
  placeholder?: string;
  /** Controlled value. */
  value?: string;
  /** Called when the user selects an option. Passes the option value. */
  onChange?: (value: string) => void;
  /** Default value (uncontrolled). */
  defaultValue?: string;
  /** Expands the trigger to full width of its container. */
  fullWidth?: boolean;
  /** Disables the select. */
  disabled?: boolean;
  /** Marks the field as required (adds `*` to label). */
  required?: boolean;
  /** Additional CSS class for the wrapper. */
  className?: string;
  /** Name for form submission. Renders a hidden native `<select>`. */
  name?: string;
  /** Aria label for the trigger (when no visible label). */
  "aria-label"?: string;
};

// ── Component ───────────────────────────────────────────────────────────────────

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      value,
      onChange,
      defaultValue,
      fullWidth = false,
      disabled = false,
      required = false,
      className,
      name,
      "aria-label": ariaLabel,
    },
    ref,
  ) => {
    const autoId = useId();
    const selectId = autoId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const selectedLabel = options.find((o) => o.value === value)?.label;

    return (
      <div
        data-slot="select"
        className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
      >
        {label && (
          <label data-slot="select-label" className={styles.label} id={`${selectId}-label`}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <SelectPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          onValueChange={(val) => {
            if (val !== null) onChange?.(val);
          }}
          disabled={disabled}
          name={name}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            data-slot="select-trigger"
            className={clsx(styles.trigger, error && styles.triggerError)}
            aria-label={ariaLabel}
            aria-labelledby={label ? `${selectId}-label` : undefined}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
          >
            <SelectPrimitive.Value
              data-slot="select-value"
              className={styles.value}
              placeholder={placeholder}
            >
              {selectedLabel}
            </SelectPrimitive.Value>
            <SelectPrimitive.Icon data-slot="select-icon" className={styles.icon}>
              <IconSelector size={14} aria-hidden="true" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner sideOffset={4} align="start" className={styles.positioner}>
              <SelectPrimitive.Popup data-slot="select-popup" className={styles.popup}>
                <SelectPrimitive.List data-slot="select-list" className={styles.list}>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} option={opt} />
                  ))}
                </SelectPrimitive.List>
              </SelectPrimitive.Popup>
            </SelectPrimitive.Positioner>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {error && (
          <p data-slot="select-error" id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p data-slot="select-helper" id={helperId} className={styles.helper}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

// ── Internal SelectItem ────────────────────────────────────────────────────────

function SelectItem({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={option.value}
      disabled={option.disabled}
      className={styles.item}
    >
      <SelectPrimitive.ItemText data-slot="select-item-text">
        {option.label}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        data-slot="select-item-indicator"
        className={styles.itemIndicator}
        render={<IconCheck size={14} aria-hidden="true" />}
      />
    </SelectPrimitive.Item>
  );
}
