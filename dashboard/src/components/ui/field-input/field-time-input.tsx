import { clsx } from "clsx";
import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { IconChevronDown } from "@tabler/icons-react";

import { useRegisterFieldEvents } from "./hooks/use-register-field-events";
import styles from "./field-input.module.scss";

export type FieldTimeInputProps = {
  /** Unique ID linking to the editing cell. */
  instanceId: string;
  /** Controlled value in HH:MM format (e.g., "09:00"). */
  value: string;
  /** Placeholder shown when empty. @default "HH:MM" */
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

// ── Constants ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

/** Match HH:MM format (24h, leading zeros). */
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Inline-editing time picker — popover grid with hour × minute columns.
 *
 * Clicking the field opens a popover showing:
 * - Left column: 00–23 hours (scrollable)
 * - Right column: 00, 15, 30, 45 minutes
 *
 * Clicking an hour highlights it. Clicking a minute commits the full time
 * value and closes. Keyboard: Arrow keys navigate, Enter picks, Escape closes.
 *
 * Also supports direct typing of HH:MM with the keyboard.
 */
export function FieldTimeInput({
  instanceId,
  value,
  placeholder = "HH:MM",
  autoFocus,
  onChange,
  onEnter,
  onEscape,
  onTab,
  onShiftTab,
  onClickOutside,
  disabled,
  className,
}: FieldTimeInputProps) {
  const [internalText, setInternalText] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeHour, setActiveHour] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse current value into hour/minute parts
  const parsed = value.match(TIME_RE);
  const currentHour = parsed ? parsed[1] : null;
  const currentMinute = parsed ? parsed[2] : null;

  // Sync external value changes
  useEffect(() => {
    setInternalText(value);
  }, [value]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const commit = useCallback(
    (time: string) => {
      setInternalText(time);
      setIsOpen(false);
      setActiveHour(null);
      onEnter?.(time);
    },
    [onEnter],
  );

  const selectMinute = useCallback(
    (minute: string) => {
      if (activeHour) {
        const time = `${activeHour}:${minute}`;
        commit(time);
      }
    },
    [activeHour, commit],
  );

  const selectHour = useCallback((hour: string) => {
    setActiveHour(hour);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setInternalText(raw);
      onChange?.(raw);

      // Auto-open popover when typing
      if (!isOpen && raw.length > 0) {
        setIsOpen(true);
      }
    },
    [onChange, isOpen],
  );

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
      }
      if (e.key === "Enter" && isOpen && activeHour) {
        e.preventDefault();
        // If a minute is also selected implicitly or we just pick :00
        const time = `${activeHour}:00`;
        commit(time);
      }
      // Let useRegisterFieldEvents handle Escape/Tab
    },
    [isOpen, activeHour, commit],
  );

  const toggleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Register keyboard + click-outside events (on the wrapper, not the input)
  useRegisterFieldEvents({
    inputRef: wrapperRef,
    inputValue: internalText,
    onEnter: (_v) => {
      if (isOpen) {
        // In popover mode, Enter commits the selected time
        if (activeHour) {
          commit(`${activeHour}:00`);
          return;
        }
      }
      // Otherwise, try to parse and commit the typed text
      const formatted = formatTypedTime(internalText);
      if (formatted) commit(formatted);
    },
    onEscape: (v) => {
      if (isOpen) {
        setIsOpen(false);
        setActiveHour(null);
        return;
      }
      onEscape?.(v);
    },
    onTab: (v) => {
      const formatted = formatTypedTime(internalText);
      onTab?.(formatted ?? v);
    },
    onShiftTab: (v) => {
      const formatted = formatTypedTime(internalText);
      onShiftTab?.(formatted ?? v);
    },
    onClickOutside: (e, v) => {
      if (isOpen) {
        // Popover handles its own click-outside via the popover
        return;
      }
      const formatted = formatTypedTime(internalText);
      onClickOutside?.(e, formatted ?? v);
    },
  });

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveHour(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      id={instanceId}
      data-slot="field-time-input"
      className={clsx(styles.fieldTimeWrapper, className)}
    >
      {/* Display / trigger */}
      <div className={styles.fieldTimeTrigger} onClick={toggleOpen}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className={styles.fieldInput}
          value={internalText}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <span className={styles.fieldTimeChevron} aria-hidden="true">
          <IconChevronDown size={14} />
        </span>
      </div>

      {/* Popover */}
      {isOpen && (
        <div className={styles.fieldTimePopover} data-slot="field-time-popover">
          {/* Hours column */}
          <div className={styles.fieldTimeColumn}>
            <div className={styles.fieldTimeColumnLabel}>Hour</div>
            <div className={styles.fieldTimeColumnList}>
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className={clsx(
                    styles.fieldTimeOption,
                    (activeHour === hour || currentHour === hour) && styles.fieldTimeOptionActive,
                  )}
                  onClick={() => selectHour(hour)}
                >
                  {hour}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes column */}
          <div className={styles.fieldTimeColumn}>
            <div className={styles.fieldTimeColumnLabel}>Minute</div>
            <div className={styles.fieldTimeColumnList}>
              {MINUTES.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  className={clsx(
                    styles.fieldTimeOption,
                    activeHour && currentMinute === minute && styles.fieldTimeOptionActive,
                    !activeHour && styles.fieldTimeOptionDisabled,
                  )}
                  onClick={() => selectMinute(minute)}
                  disabled={!activeHour}
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

FieldTimeInput.displayName = "FieldTimeInput";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format raw digits into HH:MM. Returns null if invalid. */
function formatTypedTime(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length <= 2) {
    const hh = digits.padStart(2, "0");
    const h = parseInt(hh, 10);
    if (h > 23) return null;
    return `${hh}:00`;
  }
  const hh = digits.slice(0, 2);
  const mm = digits.slice(2, 4).padEnd(2, "0");
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  if (h > 23 || m > 59) return null;
  return `${hh}:${mm}`;
}
