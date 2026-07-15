/**
 * Jotai State Layer — typed, keyed, debuggable atom factories.
 *
 * This module wraps Jotai's raw `atom()` / `atomWithStorage()` with a
 * consistent abstraction that provides:
 *
 * - **Type wrappers:** Every atom carries `{ type, key, atom }` metadata
 * - **Debug labels:** All atoms are labeled for devtools inspection
 * - **Persistence options:** localStorage / sessionStorage with validation
 * - **Selector pattern:** Read-only derived atoms with equality checks
 * - **Family pattern:** Parameterized atoms with automatic key generation
 * - **Typed consumption hooks:** `useStateValue`, `useState`, `useSetState`
 *
 * ## Quick Start
 *
 * ```ts
 * import { createState, createSelector, useStateValue } from "@/infrastructure/state/jotai";
 *
 * // Writable state
 * const themeState = createState<Theme>({
 *   key: "theme",
 *   defaultValue: "light",
 *   localStorage: true,
 * });
 *
 * // Derived selector
 * const isDarkSelector = createSelector({
 *   key: "isDark",
 *   get: ({ get }) => get(themeState) === "dark",
 * });
 *
 * // In components
 * function MyComponent() {
 *   const theme = useStateValue(themeState);
 *   const isDark = useStateValue(isDarkSelector);
 * }
 * ```
 *
 * ## Naming Convention
 *
 * - **State:** `{descriptor}State` → `themeState`, `authTokenState`
 * - **Selector:** `{descriptor}Selector` → `isDarkSelector`, `visibleColumnsSelector`
 * - **FamilyState:** `{descriptor}FamilyState` → `tableSortFamilyState`
 * - **FamilySelector:** `{descriptor}FamilySelector` → `metadataStatusFamilySelector`
 */

// ── Factories ──────────────────────────────────────────────────────────

export { createState } from "./utils/create-state";
export { createSelector } from "./utils/create-selector";
export {
  createFamilyState,
  createPersistentFamilyState,
} from "./utils/create-family-state";

// ── Types ──────────────────────────────────────────────────────────────

export type {
  State,
  Selector,
  FamilyState,
  FamilySelector,
  ComponentState,
  SelectorGetter,
} from "./types";

// ── Hooks ──────────────────────────────────────────────────────────────

export {
  useStateValue,
  useState,
  useSetState,
} from "./hooks";
