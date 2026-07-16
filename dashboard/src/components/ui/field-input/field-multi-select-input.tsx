import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";

import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { useRegisterFieldEvents } from "./hooks/use-register-field-events";
import styles from "./field-input.module.scss";

export type FieldMultiSelectInputProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled selected values. */
  values: string[];
  /** Available options. */
  options: MultiSelectOption[];
  /** Called when selection changes — parent handles persist. */
  onOptionSelected: (values: string[]) => void;
  /** Called when Escape is pressed — closes without persist. */
  onEscape?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Inline-editing multi-select — no label, no error.
 *
 * Each toggle adds/removes a value. The parent persists on each
 * change. Escape closes the edit mode. Click-outside is NOT wired
 * — the MultiSelect popup handles its own dismissal.
 */
export function FieldMultiSelectInput({
  values,
  options,
  onOptionSelected,
  onEscape,
  placeholder,
  disabled,
  className,
}: FieldMultiSelectInputProps) {
  const [internalValues, setInternalValues] = useState<string[]>(values);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInternalValues(values);
  }, [values]);

  const handleChange = (newValues: string[]) => {
    setInternalValues(newValues);
    onOptionSelected(newValues);
  };

  useRegisterFieldEvents<string[]>({
    inputRef: wrapperRef,
    inputValue: internalValues,
    onEscape: onEscape ? () => onEscape() : undefined,
  });

  return (
    <div ref={wrapperRef} data-no-close className={clsx(className)}>
      <MultiSelect
        options={options}
        values={internalValues}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={styles.fieldSelectDropdown}
      />
    </div>
  );
}
