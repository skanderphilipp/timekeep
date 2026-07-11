import { type ReactNode, type Ref } from "react";

import styles from "./infinite-scroll-sentinel.module.scss";

type InfiniteScrollSentinelProps = {
  /** Ref observed by an IntersectionObserver (see useInfiniteScrollSentinel). */
  ref: Ref<HTMLDivElement>;
  /** Loading indicator or end-of-list message. */
  children?: ReactNode;
};

/**
 * Observed footer row for infinite scrolling lists.
 *
 * Renders a centered container that an IntersectionObserver watches —
 * when it scrolls into view, the consumer fetches the next page.
 */
export function InfiniteScrollSentinel({ ref, children }: InfiniteScrollSentinelProps) {
  return (
    <div data-slot="infinite-scroll-sentinel" ref={ref} className={styles.sentinel}>
      {children}
    </div>
  );
}
