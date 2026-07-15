import { clsx } from "clsx";
import { Separator as BaseUISeparator } from "@base-ui/react/separator";

import styles from "./separator.module.scss";

type SeparatorProps = {
  /** Optional text to display between separator lines. */
  label?: string;
  /** Remove default vertical margins. */
  noMargin?: boolean;
  className?: string;
};

/**
 * Horizontal separator / divider built on @base-ui/react/separator.
 *
 * Plain mode: renders a `<div role="separator">` with proper ARIA.
 * Labelled mode: renders text between two separator lines
 * (base-ui does not natively support labels, so we compose manually).
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
        <BaseUISeparator data-slot="separator-line" className={styles.line} />
        <span data-slot="separator-label" className={styles.label}>
          {label}
        </span>
        <BaseUISeparator data-slot="separator-line" className={styles.line} />
      </div>
    );
  }

  return (
    <BaseUISeparator
      data-slot="separator"
      data-no-margin={noMargin || undefined}
      className={clsx(styles.root, noMargin && styles.noMargin, className)}
    />
  );
}

Separator.displayName = "Separator";
