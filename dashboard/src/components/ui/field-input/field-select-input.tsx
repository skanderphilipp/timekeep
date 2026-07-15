import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useRegisterFieldEvents } from "./hooks/use-register-field-events";
import styles from "./field-input.module.scss";

export type FieldSelectInputProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled value. */
  value: string | undefined;
  /** Available options. */
  options: ComboboxOption[];
  /** Called when user selects an option — parent handles persist + close. */
  onOptionSelected: (value: string) => void;
  /** Called when Escape is pressed — closes without persist. */
  onEscape?: () => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Inline-editing select dropdown — no label, no error.
 *
 * Selection triggers `onOptionSelected` immediately (single-click
 * action — no Enter confirmation needed). Escape closes without
 * persisting. Click-outside is NOT wired — the Combobox handles its
 * own dismissal, and the parent closes on selection.
 */
export function FieldSelectInput({
  value,
  options,
  onOptionSelected,
  onEscape,
  placeholder,
  searchable,
  disabled,
  className,
}: FieldSelectInputProps) {
  const [internalValue, setInternalValue] = useState<string | undefined>(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setInternalValue(newValue);
    onOptionSelected(newValue);
  };

  // Only register Escape — Combobox handles its own click-outside
  useRegisterFieldEvents<string | undefined>({
    inputRef: wrapperRef,
    inputValue: internalValue,
    onEscape: onEscape ? () => onEscape() : undefined,
    // No onClickOutside — selection triggers close via parent
  });

  return (
    <div ref={wrapperRef} data-no-close className={clsx(className)}>
      <Combobox
        options={options}
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        searchable={searchable}
        disabled={disabled}
        className={styles.fieldSelectDropdown}
      />
    </div>
  );
}
