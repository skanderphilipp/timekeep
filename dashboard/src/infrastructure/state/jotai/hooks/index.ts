import type { SetStateAction } from "react";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import type { State, Selector } from "../types";

/**
 * Reads the current value of a {@link State} or {@link Selector}.
 *
 * @example
 * ```ts
 * const theme = useStateValue(themeState);
 * const isDark = useStateValue(isDarkSelector);
 * ```
 */
export function useStateValue<ValueType>(
  state: State<ValueType> | Selector<ValueType>,
): ValueType {
  return useAtomValue(state.atom);
}

/**
 * Reads and writes a {@link State}.
 *
 * Returns a tuple `[value, setValue]` like React's `useState`.
 *
 * @example
 * ```ts
 * const [theme, setTheme] = useState(themeState);
 * setTheme("dark");
 * setTheme((prev) => (prev === "dark" ? "light" : "dark"));
 * ```
 */
export function useState<ValueType>(
  state: State<ValueType>,
): [ValueType, (value: ValueType | SetStateAction<ValueType>) => void] {
  return useAtom(state.atom);
}

/**
 * Returns a setter function for a {@link State}.
 *
 * Use when a component only needs to write, not read.
 *
 * @example
 * ```ts
 * const setTheme = useSetState(themeState);
 * setTheme("dark");
 * ```
 */
export function useSetState<ValueType>(
  state: State<ValueType>,
): (value: ValueType | SetStateAction<ValueType>) => void {
  return useSetAtom(state.atom);
}
