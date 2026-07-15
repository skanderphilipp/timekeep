import { clsx } from "clsx";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { useRegisterFieldEvents } from "./hooks/use-register-field-events";
import styles from "./field-input.module.scss";

export type FieldTextInputProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled value synced from the record. */
  value: string;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Auto-focus the input on mount. */
  autoFocus?: boolean;
  /** Called on every keystroke (live draft update). */
  onChange?: (newText: string) => void;
  /** Called when Enter is pressed — persists and closes. */
  onEnter?: (newText: string) => void;
  /** Called when Escape is pressed — closes without persist. */
  onEscape?: (newText: string) => void;
  /** Called when Tab is pressed — persists and moves to next cell. */
  onTab?: (newText: string) => void;
  /** Called when Shift+Tab is pressed — persists and moves to previous cell. */
  onShiftTab?: (newText: string) => void;
  /** Called when user clicks outside the input. */
  onClickOutside?: (event: MouseEvent, inputValue: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Inline-editing text input — no label, no error.
 *
 * Designed for table cells and detail views. Uses internal state
 * synced from `value` prop. All exit events (Enter, Escape, Tab,
 * ClickOutside) pass the current draft value to the parent.
 */
export function FieldTextInput({
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
}: FieldTextInputProps) {
  const [internalText, setInternalText] = useState(value);
  const wrapperRef = useRef<HTMLInputElement>(null);

  // Sync external value changes into internal state
  useEffect(() => {
    setInternalText(value);
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setInternalText(next);
    onChange?.(next);
  };

  // Register keyboard + click-outside events
  useRegisterFieldEvents({
    inputRef: wrapperRef,
    inputValue: internalText,
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
