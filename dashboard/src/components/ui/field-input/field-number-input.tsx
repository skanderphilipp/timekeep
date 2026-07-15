import { clsx } from "clsx";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { useRegisterFieldEvents } from "./hooks/use-register-field-events";
import styles from "./field-input.module.scss";

export type FieldNumberInputProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled value synced from the record. */
  value: number | string;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Auto-focus the input on mount. */
  autoFocus?: boolean;
  /** Called on every keystroke (live draft update). Passes the raw string value. */
  onChange?: (newValue: string) => void;
  /** Called when Enter is pressed — persists and closes. */
  onEnter?: (newValue: number) => void;
  /** Called when Escape is pressed — closes without persist. */
  onEscape?: (newValue: number) => void;
  /** Called when Tab is pressed — persists and moves to next cell. */
  onTab?: (newValue: number) => void;
  /** Called when Shift+Tab is pressed — persists and moves to previous cell. */
  onShiftTab?: (newValue: number) => void;
  /** Called when user clicks outside the input. */
  onClickOutside?: (event: MouseEvent, inputValue: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Inline-editing number input — no label, no error.
 *
 * Accepts number or numeric string. Parses the value to number
 * for Enter/Escape/Tab/ClickOutside callbacks.
 */
export function FieldNumberInput({
  instanceId,
  value,
  placeholder,
  autoFocus,
  onChange,
  onEnter,
  onEscape,
  onTab,
  onShiftTab,
  onClickOutside,
  disabled,
  className,
}: FieldNumberInputProps) {
  const displayValue = typeof value === "number" ? String(value) : value;
  const parse = (s: string) => {
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
  };

  const [internalText, setInternalText] = useState(displayValue);
  const wrapperRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInternalText(displayValue);
  }, [displayValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    // Allow empty string for clearing
    if (next !== "" && !/^-?\d*\.?\d*$/.test(next)) return;
    setInternalText(next);
    onChange?.(next);
  };

  useRegisterFieldEvents<number>({
    inputRef: wrapperRef,
    inputValue: parse(internalText),
    onEnter,
    onEscape,
    onTab,
    onShiftTab,
    onClickOutside,
  });

  return (
    <input
      ref={wrapperRef}
      id={instanceId}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={clsx(styles.fieldInput, className)}
      value={internalText}
      onChange={handleChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
    />
  );
}
