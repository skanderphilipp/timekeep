import { useState, useCallback, useId } from "react";
import { clsx } from "clsx";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import ReactDatePicker from "react-datepicker";
import { IconCalendar, IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Tag } from "@/components/ui/tag";
import { formatDisplay } from "@/lib/date";

import "react-datepicker/dist/react-datepicker.css";
import styles from "./date-picker.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────

type DatePickerMode = "single" | "range";

export type DateRangePreset = {
  key: string;
  label: () => string;
  getRange: () => { from: Date; to: Date };
};

type DatePickerProps = {
  /** Accessible label rendered above the control. */
  label?: string;
  /** Validation error message. */
  error?: string;
  /** Helper text shown when no error. */
  helperText?: string;
  /** Mark as required (shows asterisk). */
  required?: boolean;
  /** Expand to full container width. */
  fullWidth?: boolean;
  value: Date | null;
  endValue?: Date | null;
  mode?: DatePickerMode;
  onChange: (date: Date | null, endDate?: Date | null) => void;
  placeholder?: string;
  clearable?: boolean;
  minDate?: Date;
  maxDate?: Date;
  dateFormat?: string;
  presets?: DateRangePreset[];
  /** Disable the control. */
  disabled?: boolean;
  className?: string;
  /** HTML id (auto-generated if omitted). */
  id?: string;
};

// ── Component ──────────────────────────────────────────────────────────────

export function DatePicker({
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  value,
  endValue,
  mode = "single",
  onChange,
  placeholder,
  clearable = true,
  minDate,
  maxDate,
  dateFormat = "yyyy-MM-dd",
  presets,
  disabled = false,
  className,
  id: externalId,
}: DatePickerProps) {
  const { _ } = useLingui();
  const autoId = useId();
  const controlId = externalId ?? autoId;
  const errorId = `${controlId}-error`;
  const helperId = `${controlId}-helper`;
  const [open, setOpen] = useState(false);

  /**
   * In range mode, the first click sets a pending start but does NOT
   * call the parent onChange. This avoids re-renders / URL updates
   * mid-selection. The parent onChange is only called when:
   *   - Both dates are selected (second click)
   *   - A preset is chosen
   *   - Clear is clicked
   */
  const [pendingRangeStart, setPendingRangeStart] = useState<Date | null>(null);

  const isRange = mode === "range";

  // Calendar sees the real value, or pendingRangeStart during selection.
  const calendarStartDate: Date | null = isRange ? (pendingRangeStart ?? value) : value;
  const calendarEndDate: Date | null = isRange
    ? pendingRangeStart
      ? null
      : (endValue ?? null)
    : null;

  // Display text uses the committed (parent) value
  const displayText = formatDisplay(value, endValue, mode, dateFormat);
  const hasValue = isRange ? !!(value || endValue) : !!value;

  // Floating UI
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      if (!next) setPendingRangeStart(null);
    },
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    strategy: "fixed",
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, { outsidePress: true });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const handleSingleChange = useCallback(
    (date: Date | null) => {
      onChange(date);
      setOpen(false);
    },
    [onChange],
  );

  const handleRangeChange = useCallback(
    (dates: [Date | null, Date | null]) => {
      const [start, end] = dates;
      if (start && end) {
        onChange(start, end);
        setPendingRangeStart(null);
        setOpen(false);
      } else if (start) {
        setPendingRangeStart(start);
      }
    },
    [onChange],
  );

  const handlePresetClick = useCallback(
    (preset: DateRangePreset) => {
      const { from, to } = preset.getRange();
      setPendingRangeStart(null);
      onChange(from, to);
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setPendingRangeStart(null);
      onChange(null, null);
    },
    [onChange],
  );

  return (
    <div
      data-slot="date-picker"
      className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
    >
      {label && (
        <label data-slot="date-picker-label" className={styles.label} htmlFor={controlId}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}

      <button
        type="button"
        id={controlId}
        ref={refs.setReference}
        {...getReferenceProps()}
        disabled={disabled}
        className={clsx(styles.trigger, error && styles.triggerError)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
      >
        <span data-slot="date-picker-icon" className={styles.icon}>
          <IconCalendar size={16} />
        </span>
        <span
          data-slot="date-picker-display"
          className={clsx(styles.display, !displayText && styles.placeholder)}
        >
          {displayText || placeholder || _(msg`Select date…`)}
        </span>
        {clearable && hasValue && (
          <span
            data-slot="date-picker-clear"
            className={styles.clear}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleClear(e);
            }}
            role="button"
            tabIndex={0}
            aria-label={_(msg`Clear date`)}
          >
            <IconX size={14} />
          </span>
        )}
      </button>

      {error && (
        <p data-slot="date-picker-error" id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p data-slot="date-picker-helper" id={helperId} className={styles.helper}>
          {helperText}
        </p>
      )}

      {open && (
        <FloatingPortal>
          <div
            data-slot="date-picker-popup"
            ref={refs.setFloating}
            style={floatingStyles}
            className={styles.popup}
            {...getFloatingProps()}
          >
            {isRange && presets && presets.length > 0 && (
              <div data-slot="date-picker-presets" className={styles.presets}>
                {presets.map((preset) => (
                  <Tag
                    key={preset.key}
                    text={preset.label()}
                    color="accent"
                    variant="outline"
                    onClick={() => handlePresetClick(preset)}
                  />
                ))}
              </div>
            )}

            {isRange ? (
              <ReactDatePicker
                inline
                selectsRange
                startDate={calendarStartDate}
                endDate={calendarEndDate ?? undefined}
                onChange={handleRangeChange}
                minDate={minDate}
                maxDate={maxDate}
                calendarClassName={styles.calendar}
              />
            ) : (
              <ReactDatePicker
                inline
                selected={value}
                onChange={handleSingleChange}
                minDate={minDate}
                maxDate={maxDate}
                calendarClassName={styles.calendar}
              />
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
