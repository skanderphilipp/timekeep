import { clsx } from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import styles from "./icon-button.module.scss";

/**
 * Icon-only button — a square button with no visible text content.
 *
 * Sizes follow the 8px grid: sm (28px), md (32px).
 * Accents mirror our semantic color tokens.
 *
 * `aria-label` is **required** — there's no text content to fall back on.
 */
type IconButtonProps = {
  /** Accessible name. Required because the button has no visible text. */
  "aria-label": string;
  /** Icon element (typically `@tabler/icons-react`). */
  children: ReactNode;
  size?: "sm" | "md";
  accent?: "primary" | "secondary" | "tertiary";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children">;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, size = "md", accent = "secondary", className, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        data-slot="icon-button"
        data-variant={accent}
        data-size={size}
        data-disabled={disabled || undefined}
        className={clsx(styles.button, className)}
        type="button"
        disabled={disabled}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
