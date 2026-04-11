import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Tracks whether an element is intersecting the viewport using
 * the native IntersectionObserver API. Zero dependencies.
 *
 * @param options - IntersectionObserverInit options (threshold, rootMargin, etc.)
 * @returns [ref, isIntersecting] — attach ref to the target element.
 *
 * @example
 * ```ts
 * const [ref, isVisible] = useIntersection({ threshold: 0.1 });
 * return <div ref={ref}>{isVisible ? "In view!" : "Scroll down"}</div>;
 * ```
 */
export function useIntersection(
  options?: IntersectionObserverInit,
): [(node: HTMLElement | null) => void, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  // eslint-disable-next-line bentech/no-state-useref — IntersectionObserver is a DOM API object, not React state
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node) return;

      const observer = new IntersectionObserver(([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      }, options);

      observer.observe(node);
      observerRef.current = observer;
    },
    // Re-create observer when options change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options?.threshold, options?.rootMargin],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [ref, isIntersecting];
}
