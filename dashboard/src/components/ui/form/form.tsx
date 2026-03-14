import { clsx } from "clsx";
import type { FormHTMLAttributes, ReactNode } from "react";

import styles from "./form.module.scss";

type FormProps = {
  children: ReactNode;
  className?: string;
} & FormHTMLAttributes<HTMLFormElement>;

/**
 * Form wrapper.
 *
 * Replaces raw `<form>` elements in pages. Provides consistent spacing
 * between form sections and fields.
 */
export function Form({ children, className, ...props }: FormProps) {
  return (
    <form
      data-slot="form"
      className={clsx(styles.form, className)}
      noValidate
      {...props}
    >
      {children}
    </form>
  );
}
