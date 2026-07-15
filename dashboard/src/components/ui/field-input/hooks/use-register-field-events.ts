import { useEffect, useRef, type RefObject } from "react";

/**
 * Registers keyboard and click-outside events for an inline editing field.
 *
 * Wires Enter, Escape, Tab, and Shift+Tab to callbacks, plus detects
 * clicks outside the input element. Callbacks receive the current draft
 * value by closure (re-registered via dependencies array on value change).
 *
 * Simpler than Twenty's version — uses raw DOM events instead of
 * `react-hotkeys-hook` and a focus stack. Suitable for MVP inline
 * editing where only one cell is editable at a time.
 *
 * @example
 * useRegisterFieldEvents({
 *   inputRef: wrapperRef,
 *   inputValue: draftText,
 *   focusId: cellId,
 *   onEnter: (val) => persist(val),
 *   onEscape: (val) => close(),
 * });
 */
export function useRegisterFieldEvents<T>({
  inputRef,
  inputValue,
  onEnter,
  onEscape,
  onTab,
  onShiftTab,
  onClickOutside,
  enabled = true,
  /** When true, skip click-outside detection (e.g., when a dropdown is open). */
  skipClickOutside = false,
}: {
  inputRef: RefObject<HTMLElement | null>;
  inputValue: T;
  onEnter?: (inputValue: T) => void;
  onEscape?: (inputValue: T) => void;
  onTab?: (inputValue: T) => void;
  onShiftTab?: (inputValue: T) => void;
  onClickOutside?: (event: MouseEvent, inputValue: T) => void;
  enabled?: boolean;
  skipClickOutside?: boolean;
}) {
  // Store callbacks in refs so we don't need to re-register listeners
  const inputValueRef = useRef(inputValue);
  const onEnterRef = useRef(onEnter);
  const onEscapeRef = useRef(onEscape);
  const onTabRef = useRef(onTab);
  const onShiftTabRef = useRef(onShiftTab);
  const onClickOutsideRef = useRef(onClickOutside);
  const skipClickOutsideRef = useRef(skipClickOutside);

  // Keep refs in sync without re-registering listeners
  useEffect(() => { inputValueRef.current = inputValue; }, [inputValue]);
  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);
  useEffect(() => { onEscapeRef.current = onEscape; }, [onEscape]);
  useEffect(() => { onTabRef.current = onTab; }, [onTab]);
  useEffect(() => { onShiftTabRef.current = onShiftTab; }, [onShiftTab]);
  useEffect(() => { onClickOutsideRef.current = onClickOutside; }, [onClickOutside]);
  useEffect(() => { skipClickOutsideRef.current = skipClickOutside; }, [skipClickOutside]);

  // ── Keyboard events ──────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { key } = e;

      if (key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onEnterRef.current?.(inputValueRef.current);
      } else if (key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onEscapeRef.current?.(inputValueRef.current);
      } else if (key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          onShiftTabRef.current?.(inputValueRef.current);
        } else {
          onTabRef.current?.(inputValueRef.current);
        }
      }
    };

    const el = inputRef.current;
    el?.addEventListener("keydown", handleKeyDown);
    return () => el?.removeEventListener("keydown", handleKeyDown);
  }, [inputRef, enabled]);

  // ── Click-outside events ─────────────────────────────────────

  useEffect(() => {
    if (!enabled || !onClickOutside) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (skipClickOutsideRef.current) return;

      const el = inputRef.current;
      if (!el) return;

      // Ignore clicks inside the input element
      if (el.contains(e.target as Node)) return;

      // Ignore clicks on elements with data-no-close attribute
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-close]")) return;

      onClickOutsideRef.current?.(e, inputValueRef.current);
    };

    // Use mousedown (not click) for faster response and to avoid
    // race conditions with other event handlers
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [inputRef, enabled, onClickOutside]);
}
