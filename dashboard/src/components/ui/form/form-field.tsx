import { clsx } from "clsx";
import { useId, type ReactNode } from "react";

import styles from "./form.module.scss";

type FormFieldProps = {
  /** Field label text. */
  label: string;
  /** The input/select/toggle control. */
  children: ReactNode;
  /** Mark as required (shows asterisk). */
  required?: boolean;
  /** Validation error message. Shows red text below the control. */
  error?: string;
  /** Helper text (only shown when no error). */
  helperText?: string;
  /** Explicit id for the label's `htmlFor` and the error's `id` anchor. */
  htmlFor?: string;
  className?: string;
};

/**
 * Form field layout wrapper.
 *
 * Composes an accessible label (`<label htmlFor={id}>`), control,
 * and optional error/helper text into a consistent vertical stack.
 *
 * The control child (Input, Select, Checkbox, Toggle) should NOT include
 * its own label — FormField provides it. Pass `htmlFor` to associate the
 * label with the control's `id` for screen-reader accessibility.
 */
export function FormField({
  label,
  children,
  required = false,
  error,
  helperText,
  htmlFor,
  className,
}: FormFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;

  return (
    <div
      data-slot="form-field"
      data-required={required || undefined}
      data-has-error={!!error || undefined}
      className={clsx(styles.field, className)}
    >
      <div data-slot="form-field-header" className={styles.fieldHeader}>
        <label data-slot="form-field-label" className={styles.label} htmlFor={fieldId}>
          {label}
          {required && (
            <span data-slot="form-field-required" className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
      </div>

      <div data-slot="form-field-control">{children}</div>

      {error && (
        <p
          data-slot="form-field-error"
          id={`${fieldId}-error`}
          className={styles.error}
          role="alert"
        >
          {error}
        </p>
      )}
      {!error && helperText && (
        <p data-slot="form-field-helper" id={`${fieldId}-helper`} className={styles.helper}>
          {helperText}
        </p>
      )}
    </div>
  );
}
