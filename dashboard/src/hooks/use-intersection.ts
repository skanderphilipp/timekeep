/**
 * Intersection observer hook — thin wrapper around `react-intersection-observer`.
 *
 * Replaces the previous custom IntersectionObserver implementation with a
 * battle-tested library that handles edge cases (SSR, cleanup, reconnection).
 *
 * @example
 * ```ts
 * const { ref, inView } = useIntersection({ threshold: 0.1, triggerOnce: true });
 * return <div ref={ref}>{inView ? "Visible!" : "Hidden"}</div>;
 * ```
 */
export { useInView as useIntersection } from "react-intersection-observer";
