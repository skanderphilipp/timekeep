import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./form.module.scss";

type FormActionsProps = {
  children: ReactNode;
  /** Horizontal alignment. */
  align?: "left" | "right";
  className?: string;
};

/**
 * Button group for form submission and cancellation.
 *
 * Replaces raw `<div data-slot="form-actions">` in pages.
 * Default alignment is right (submit on the right, cancel on the left).
 */
export function FormActions({ children, align = "right", className }: FormActionsProps) {
  return (
    <div
      data-slot="form-actions"
      data-align={align}
      className={clsx(styles.actions, styles[align], className)}
    >
      {children}
    </div>
  );
}
