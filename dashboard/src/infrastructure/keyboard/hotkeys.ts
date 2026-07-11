/**
 * Global keyboard shortcut system.
 *
 * Mirrors Reaktly's useGlobalHotkeys pattern: register callbacks on
 * specific key combinations, supports modifier keys, ignores input focus.
 */
import { useEffect, useCallback } from "react";

type HotkeyCallback = () => void;

type HotkeyRegistration = {
  keys: string[];
  callback: HotkeyCallback;
};

type HotkeyContext = {
  register: (keys: string[], callback: HotkeyCallback) => () => void;
};

// Normalize key string for comparison: "ctrl+k" → { ctrl: true, key: "k" }
function parseKeyCombo(combo: string): { modifiers: Set<string>; key: string } {
  const parts = combo.toLowerCase().split("+");
  const modifiers = new Set<string>();
  let key = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === "ctrl" || trimmed === "meta" || trimmed === "cmd") {
      modifiers.add("ctrl");
    } else if (trimmed === "shift") {
      modifiers.add("shift");
    } else if (trimmed === "alt") {
      modifiers.add("alt");
    } else {
      key = trimmed;
    }
  }

  return { modifiers, key };
}

// Elements where we should NOT trigger global hotkeys (user is typing)
const INPUT_ELEMENTS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

/** Create a hotkey context. Call once at app root. */
export function useHotkeyContext(): HotkeyContext {
  const registrationsRef = { current: new Map<string, HotkeyRegistration>() };

  const register = useCallback((keys: string[], callback: HotkeyCallback) => {
    const id = Math.random().toString(36).slice(2);
    registrationsRef.current.set(id, { keys, callback });
    return () => {
      registrationsRef.current.delete(id);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (INPUT_ELEMENTS.has(target.tagName) || target.isContentEditable) {
        return;
      }

      const pressedKey = e.key.toLowerCase();
      const pressedMods = new Set<string>();
      if (e.ctrlKey || e.metaKey) pressedMods.add("ctrl");
      if (e.shiftKey) pressedMods.add("shift");
      if (e.altKey) pressedMods.add("alt");

      for (const reg of registrationsRef.current.values()) {
        for (const combo of reg.keys) {
          const { modifiers, key } = parseKeyCombo(combo);

          // Check modifiers match
          const modsMatch =
            modifiers.size === pressedMods.size && [...modifiers].every((m) => pressedMods.has(m));

          if (modsMatch && key === pressedKey) {
            e.preventDefault();
            e.stopPropagation();
            reg.callback();
            return;
          }
        }
      }
    };

    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [registrationsRef]);

  return { register };
}

/**
 * Register a global hotkey. Must be called inside a component that is inside
 * the HotkeyProvider context.
 */
export function useGlobalHotkey(keys: string[], callback: HotkeyCallback, deps: unknown[] = []) {
  // Simple implementation: just useEffect on the document
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (INPUT_ELEMENTS.has(target.tagName) || target.isContentEditable) return;

      for (const combo of keys) {
        const { modifiers, key } = parseKeyCombo(combo);
        const pressedKey = e.key.toLowerCase();
        const ctrlPressed = e.ctrlKey || e.metaKey;

        const modsMatch =
          modifiers.has("ctrl") === ctrlPressed &&
          modifiers.has("shift") === e.shiftKey &&
          modifiers.has("alt") === e.altKey;

        if (modsMatch && key === pressedKey) {
          e.preventDefault();
          callback();
          return;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, callback]);
}
