import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./field-input-container.module.scss";

/**
 * Visual wrapper for all form field input controls.
 *
 * Ensures consistent min-height and alignment across all field types.
 * Ported from pulse's `FieldInputContainer`.
 */
export function FieldInputContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="field-input-container"
      className={clsx(styles.container, className)}
    >
      {children}
    </div>
  );
}
