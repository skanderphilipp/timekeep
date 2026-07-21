/**
 * Detects whether the app is running inside a Tauri desktop window.
 *
 * In Tauri v2, the runtime injects `window.__TAURI_INTERNALS__` into the
 * webview. Its presence is the canonical way to distinguish the desktop app
 * from a regular browser tab.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
