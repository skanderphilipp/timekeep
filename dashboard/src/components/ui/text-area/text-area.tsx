import { clsx } from "clsx";
import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

import styles from "./text-area.module.scss";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      helperText,
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
    const textareaId = externalId || autoId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div
        data-slot="text-area"
        className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
      >
        {label && (
          <label data-slot="text-area-label" className={styles.label} htmlFor={textareaId}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          data-slot="text-area-field"
          className={clsx(styles.textarea, error && styles.textareaError)}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          {...rest}
        />

        {error && (
          <p data-slot="text-area-error" id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p data-slot="text-area-helper" id={helperId} className={styles.helper}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

TextArea.displayName = "TextArea";
