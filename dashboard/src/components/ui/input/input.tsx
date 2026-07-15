import { clsx } from "clsx";
import {
  forwardRef,
  useCallback,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./input.module.scss";

const INPUT_TYPE_PASSWORD = "password";

type InputSize = "sm" | "md";

type InputProps = {
  /** Label rendered above the input. */
  label?: string;
  /** Validation error message. Shows red text below the control. */
  error?: string;
  /** Helper text (only shown when no error). */
  helperText?: string;
  /** Icon or element rendered inside the left edge of the input. */
  leftAdornment?: ReactNode;
  /** Icon or element rendered inside the right edge of the input.
   *  When `type="password"`, the built-in show/hide toggle takes
   *  precedence — pass nothing for rightAdornment. */
  rightAdornment?: ReactNode;
  /** Stretches the container to 100% width. */
  fullWidth?: boolean;
  /** Control height: `sm` = 28px, `md` = 32px (default). */
  sizeVariant?: InputSize;
  /** Grow the input width to fit its content (like inline-edit fields).
   *  Uses a hidden span to measure text width, then sets the input
   *  width to match via inline style. Best paired with a min-width. */
  autoGrow?: boolean;
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
      sizeVariant = "md",
      autoGrow = false,
      className,
      id: externalId,
      disabled,
      required,
      type: inputType,
      value,
      placeholder,
      onChange,
      ...rest
    },
    ref,
  ) => {
    const { _ } = useLingui();
    const autoId = useId();
    const inputId = externalId ?? autoId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const measureRef = useRef<HTMLSpanElement>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // ── Password visibility toggle ──────────────────────────────
    const isPassword = inputType === INPUT_TYPE_PASSWORD;
    const [passwordVisible, setPasswordVisible] = useState(false);
    const resolvedType = isPassword && passwordVisible ? "text" : inputType;

    const togglePassword = useCallback(
      () => setPasswordVisible((prev) => !prev),
      [],
    );

    // ── autoGrow: sync input width to measured text width ────────
    const handleAutoGrowChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e);
        // Let a tick pass so the measure span updates
        if (measureRef.current && inputRef.current) {
          requestAnimationFrame(() => {
            if (measureRef.current && inputRef.current) {
              const measured = measureRef.current.offsetWidth;
              // Add a small buffer (8px) so the caret has breathing room
              inputRef.current.style.width = `${measured + 8}px`;
            }
          });
        }
      },
      [onChange],
    );

    // ── Resolved right adornment ───────────────────────────────
    const resolvedRightAdornment =
      isPassword ? (
        <button
          type="button"
          className={styles.adornmentButton}
          onClick={togglePassword}
          tabIndex={-1}
          aria-label={
            passwordVisible
              ? _(msg`Hide password`)
              : _(msg`Show password`)
          }
        >
          {passwordVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      ) : (
        rightAdornment
      );

    // ── Computed value for autoGrow measuring ──────────────────
    const displayValue =
      typeof value === "string"
        ? value
        : typeof value === "number"
          ? String(value)
          : rest.defaultValue
            ? String(rest.defaultValue)
            : placeholder ?? "";

    return (
      <div
        data-slot="input"
        className={clsx(
          styles.container,
          fullWidth && styles.fullWidth,
          autoGrow && styles.autoGrowContainer,
          className,
        )}
      >
        {label && (
          <label
            data-slot="input-label"
            className={styles.label}
            htmlFor={inputId}
          >
            {label}
            {required && (
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div data-slot="input-wrapper" className={styles.inputWrapper}>
          {leftAdornment && (
            <span
              data-slot="input-adornment-left"
              className={styles.adornment}
            >
              {leftAdornment}
            </span>
          )}

          {/* Hidden span for autoGrow text measurement */}
          {autoGrow && (
            <span
              ref={measureRef}
              aria-hidden="true"
              className={styles.measure}
            >
              {displayValue || placeholder || "\u200B"}
            </span>
          )}

          <input
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            id={inputId}
            data-slot="input-field"
            className={clsx(
              styles.input,
              styles[sizeVariant],
              error && styles.inputError,
              leftAdornment && styles.hasLeftAdornment,
              resolvedRightAdornment && styles.hasRightAdornment,
              autoGrow && styles.autoGrow,
            )}
            type={resolvedType}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            onChange={autoGrow ? handleAutoGrowChange : onChange}
            {...rest}
          />

          {resolvedRightAdornment && (
            <span
              data-slot="input-adornment-right"
              className={styles.adornment}
            >
              {resolvedRightAdornment}
            </span>
          )}
        </div>

        {error && (
          <p
            data-slot="input-error"
            id={errorId}
            className={styles.error}
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            data-slot="input-helper"
            id={helperId}
            className={styles.helper}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
