/**
 * Keys that should NOT trigger inline editing when pressed.
 *
 * Navigation keys, modifiers, function keys, and media keys
 * are excluded so "just start typing" only opens the editor
 * when the user actually types a character.
 *
 * Ported from Twenty's `isNonTextWritingKey.ts`.
 */
const NON_TEXT_KEYS = new Set([
  "Enter", "Tab", "Shift", "Escape",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Delete", "Backspace",
  "F1", "F2", "F3", "F4", "F5", "F6",
  "F7", "F8", "F9", "F10", "F11", "F12",
  "Meta", "Alt", "Control", "CapsLock", "NumLock", "ScrollLock",
  "Pause", "Insert", "Home", "End", "PageUp", "PageDown",
  "ContextMenu", "PrintScreen",
]);

export function isNonTextWritingKey(key: string): boolean {
  return NON_TEXT_KEYS.has(key);
}
