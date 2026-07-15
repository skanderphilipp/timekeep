import { clsx } from "clsx";
import { useEffect, useState } from "react";

import { BooleanDisplay } from "@/components/ui/display";
import styles from "./field-input.module.scss";

export type FieldBooleanInputProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled value synced from the record. */
  value: boolean;
  /** Called when the user toggles the value. Parent handles persist. */
  onToggle?: (newValue: boolean) => void;
  /** Read-only mode — toggle is disabled, cursor is default. */
  readonly?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Inline-editing boolean toggle — click to flip true/false.
 *
 * Designed for table cells. Uses BooleanDisplay for the visual.
 * Fires onToggle immediately (no Enter/Escape flow needed — boolean
 * is a single-click action, not a multi-step edit).
 */
export function FieldBooleanInput({
  value,
  onToggle,
  readonly,
  className,
  "data-testid": testId,
}: FieldBooleanInputProps) {
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleClick = () => {
    if (readonly) return;
    const next = !internalValue;
    setInternalValue(next);
    onToggle?.(next);
  };

  return (
    <span
      data-slot="field-boolean-input"
      data-testid={testId}
      className={clsx(
        styles.fieldBooleanContainer,
        readonly && styles.fieldBooleanReadonly,
        className,
      )}
      onClick={readonly ? undefined : handleClick}
      role="button"
      tabIndex={readonly ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <BooleanDisplay value={internalValue} />
    </span>
  );
}
