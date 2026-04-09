import type { ReactNode } from "react";
import styles from "./visually-hidden.module.scss";

type VisuallyHiddenProps = {
  children: ReactNode;
};

/**
 * Hides content visually while keeping it accessible to screen readers.
 * Use for labels, status messages, and skip links that should be announced
 * but not visible.
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className={styles.root}>{children}</span>;
}
