import { clsx } from "clsx";

import styles from "./skeleton.module.scss";

type SkeletonProps = {
  /** Predefined shape shortcuts */
  variant?: "text" | "circle" | "rect";
  width?: string | number;
  height?: string | number;
  className?: string;
};

export function Skeleton({
  variant = "text",
  width,
  height,
  className,
}: SkeletonProps) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden="true"
      className={clsx(styles.skeleton, styles[variant], className)}
      style={{ width, height }}
    />
  );
}

/** A block of multiple skeleton lines (e.g., for loading card content). */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div data-slot="skeleton-lines" className={styles.lines}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}
