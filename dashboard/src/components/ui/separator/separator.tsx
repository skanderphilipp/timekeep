import { clsx } from "clsx";

import styles from "./separator.module.scss";

type SeparatorProps = {
  /** Optional text to display between separator lines. */
  label?: string;
  /** Remove default vertical margins. */
  noMargin?: boolean;
  className?: string;
};

/**
 * Horizontal separator / divider.
 * Can render as a plain line or with centered text (e.g., "or").
 */
export function Separator({ label, noMargin = false, className }: SeparatorProps) {
  if (label) {
    return (
      <div
        data-slot="separator"
        data-variant="labelled"
        data-no-margin={noMargin || undefined}
        className={clsx(styles.labelled, noMargin && styles.noMargin, className)}
      >
        <span data-slot="separator-line" className={styles.line} />
        <span data-slot="separator-label" className={styles.label}>
          {label}
        </span>
        <span data-slot="separator-line" className={styles.line} />
      </div>
    );
  }

  return (
    <hr
      data-slot="separator"
      data-no-margin={noMargin || undefined}
      className={clsx(styles.root, noMargin && styles.noMargin, className)}
    />
  );
}
