import { clsx } from "clsx";
import { type ReactNode } from "react";

import styles from "./dropdown-content.module.scss";

/**
 * Styled container for dropdown menu items.
 *
 * Provides the visual boundaries (background, border, shadow, min-width)
 * and scroll overflow for long menus.
 */
type DropdownContentProps = {
  children: ReactNode;
  className?: string;
};

export function DropdownContent({ children, className }: DropdownContentProps) {
  return (
    <div data-slot="dropdown-content" className={clsx(styles.content, className)} role="none">
      {children}
    </div>
  );
}
