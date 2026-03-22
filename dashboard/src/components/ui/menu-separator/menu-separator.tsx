import { clsx } from "clsx";

import styles from "./menu-separator.module.scss";

/**
 * Horizontal divider inside a dropdown or menu.
 *
 * Renders an `<hr>` with `role="separator"` for accessibility.
 * Auto-hides when it's the first or last child (via CSS).
 */
type MenuSeparatorProps = {
  className?: string;
};

export function MenuSeparator({ className }: MenuSeparatorProps) {
  return (
    <hr
      data-slot="menu-separator"
      className={clsx(styles.separator, className)}
      aria-orientation="horizontal"
    />
  );
}
