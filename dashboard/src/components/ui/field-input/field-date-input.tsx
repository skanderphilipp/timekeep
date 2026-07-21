import { clsx } from "clsx";
import { useCallback, useRef, useState } from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { useRegisterFieldEvents } from "./hooks/use-register-field-events";

export type FieldDateInputProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled value (ISO date string or Date object). */
  value: Date | string | null;
  /** Called on every change (live draft update). */
  onChange?: (newDate: Date | null) => void;
  /** Called when Enter is pressed — persists and closes. */
  onEnter?: (newDate: Date | null) => void;
  /** Called when Escape is pressed — closes without persist. */
  onEscape?: (newDate: Date | null) => void;
  /** Called when user clicks outside — persists and closes. */
  onClickOutside?: (event: MouseEvent, inputValue: Date | null) => void;
  /** Show a clear button. */
  clearable?: boolean;
  /** Minimum selectable date. */
  minDate?: Date;
  /** Maximum selectable date. */
  maxDate?: Date;
  className?: string;
};

function toDate(v: Date | string | null): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Inline-editing date picker — no label, no error.
 *
 * Wraps our self-contained DatePicker, wiring its onChange
 * to draft updates and keyboard/click-outside to exit events.
 */
export function FieldDateInput({
  value,
  onChange,
  onEnter,
  onEscape,
  onClickOutside,
  clearable,
  minDate,
  maxDate,
  className,
}: FieldDateInputProps) {
  const [internalValue, setInternalValue] = useState<Date | null>(toDate(value));
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback(
    (date: Date | null) => {
      setInternalValue(date);
      onChange?.(date);
    },
    [onChange],
  );

  // Register keyboard + click-outside events on the wrapper div
  useRegisterFieldEvents<Date | null>({
    inputRef: wrapperRef,
    inputValue: internalValue,
    onEnter,
    onEscape,
    onClickOutside,
  });

  return (
    <div data-slot="field-date-input" ref={wrapperRef} className={clsx(className)} data-no-close>
      <DatePicker
        value={internalValue}
        onChange={handleChange}
        clearable={clearable}
        minDate={minDate}
        maxDate={maxDate}
      />
    </div>
  );
}
