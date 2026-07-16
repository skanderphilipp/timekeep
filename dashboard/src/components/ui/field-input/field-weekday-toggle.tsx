import { clsx } from "clsx";
import { useEffect, useRef, useState, useCallback } from "react";

import { ToggleGroup, Toggle } from "@/components/ui/toggle-group";
import styles from "./field-input.module.scss";

export type FieldWeekdayToggleProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled boolean[7] value — index 0 = Monday. */
  value: boolean[];
  /** Day labels in order (e.g., ["Mon", "Tue", ...]). */
  dayLabels: string[];
  /** Called on every toggle — updates the draft without committing. */
  onChange?: (newValue: boolean[]) => void;
  /** Called when Enter is pressed — persists and closes. */
  onEnter?: (newValue: boolean[]) => void;
  /** Called when Escape is pressed — reverts and closes. */
  onEscape?: (newValue: boolean[]) => void;
  /** Called when user clicks outside the input. */
  onClickOutside?: (event: MouseEvent, inputValue: boolean[]) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Inline-editing weekday toggle — 7 toggle buttons for Mon-Sun.
 *
 * Each button represents a working day. Toggling updates the internal
 * state and calls `onChange` to update the parent's draft value WITHOUT
 * committing. This allows the user to toggle multiple days before the
 * parent commits on Enter/click-outside/Escape (standard inline edit flow).
 *
 * Uses the existing `ToggleGroup`/`Toggle` primitives in `multiple` mode.
 */
export function FieldWeekdayToggle({
  instanceId,
  value,
  dayLabels,
  onChange,
  onEnter,
  onEscape,
  onClickOutside,
  disabled,
  className,
}: FieldWeekdayToggleProps) {
  const [internalValue, setInternalValue] = useState<boolean[]>([...value]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes into internal state
  useEffect(() => {
    setInternalValue([...value]);
  }, [value]);

  const pressedValues = internalValue
    .map((active, idx) => (active ? String(idx) : null))
    .filter((v): v is string => v !== null);

  const handleToggle = useCallback(
    (pressed: string[]) => {
      const next = dayLabels.map((_, idx) => pressed.includes(String(idx)));
      setInternalValue(next);
      onChange?.(next);
    },
    [dayLabels, onChange],
  );

  // Keyboard: commit on Enter, revert on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onEnter?.(internalValue);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onEscape?.(value); // revert to original
      }
    },
    [internalValue, value, onEnter, onEscape],
  );

  // Click-outside detection
  useEffect(() => {
    if (!onClickOutside) return;

    const handleMouseDown = (e: MouseEvent) => {
      const el = wrapperRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!el.contains(target)) {
        onClickOutside(e, [...internalValue]);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [internalValue, onClickOutside]);

  return (
    <div
      ref={wrapperRef}
      id={instanceId}
      data-slot="field-weekday-toggle"
      onKeyDown={handleKeyDown}
      className={clsx(styles.fieldWeekdayContainer, className)}
    >
      <ToggleGroup value={pressedValues} onValueChange={handleToggle} multiple disabled={disabled}>
        {dayLabels.map((label, idx) => (
          <Toggle key={String(idx)} value={String(idx)}>
            {label}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}

FieldWeekdayToggle.displayName = "FieldWeekdayToggle";
