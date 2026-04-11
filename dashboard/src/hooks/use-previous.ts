import { useRef, useEffect } from "react";

/**
 * Tracks the previous value of a variable across renders.
 *
 * Returns `undefined` on the first render, then the previous value
 * on subsequent renders. Useful for comparing props to detect changes.
 *
 * @example
 * ```ts
 * const prevCount = usePrevious(count);
 * if (prevCount !== undefined && count > prevCount) {
 *   // count increased
 * }
 * ```
 */
export function usePrevious<T>(value: T): T | undefined {
  // eslint-disable-next-line bentech/no-state-useref — canonical usePrevious pattern; ref stores value without triggering re-renders
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
