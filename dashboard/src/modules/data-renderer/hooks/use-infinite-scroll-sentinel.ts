import { useEffect, useRef, type RefObject } from "react";

type UseInfiniteScrollSentinelOptions = {
  /** Called when the sentinel enters the viewport. */
  onIntersect: () => void;
  /** Whether to enable the observer (e.g., stop when loading or done). */
  enabled: boolean;
  /** Root margin for the intersection observer (default: "200px"). */
  rootMargin?: string;
};

/**
 * Returns a ref to attach to a sentinel element at the bottom of a list.
 *
 * When the sentinel becomes visible (within `rootMargin`), `onIntersect`
 * is called — typically to fetch the next page of data.
 */
export function useInfiniteScrollSentinel({
  onIntersect,
  enabled,
  rootMargin = "200px",
}: UseInfiniteScrollSentinelOptions): RefObject<HTMLDivElement | null> {
  // oxlint-disable-next-line bentech/no-state-useref -- DOM ref for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // oxlint-disable-next-line bentech/no-state-useref -- latest-callback pattern; never affects rendering
  const onIntersectRef = useRef(onIntersect);
  onIntersectRef.current = onIntersect;

  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onIntersectRef.current();
        }
      },
      { rootMargin },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
