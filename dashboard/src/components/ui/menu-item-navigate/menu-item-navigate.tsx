import { clsx } from "clsx";
import { Link } from "react-router-dom";
import { useContext, type ReactNode } from "react";
import { IconChevronRight } from "@tabler/icons-react";

import { MenuCloseContext } from "@/components/ui/menu-item";

import styles from "./menu-item-navigate.module.scss";

/**
 * Menu item that navigates to a route via react-router `<Link>`.
 *
 * Renders a link with the same visual structure as `<MenuItem>` but
 * uses `<Link>` instead of `<button>`. An auto-trailing chevron
 * provides the "navigate" affordance.
 *
 * When wrapped in a `<Dropdown>`, clicking auto-closes the dropdown
 * before navigating.
 */
type MenuItemNavigateProps = {
  /** Icon at the leading edge. */
  leftIcon?: ReactNode;
  /** Primary text label. */
  label: string;
  /** Route path (passed to `<Link to={...}>`). */
  to: string;
  /** Disabled state. */
  disabled?: boolean;
  className?: string;
};

export function MenuItemNavigate({
  leftIcon,
  label,
  to,
  disabled = false,
  className,
}: MenuItemNavigateProps) {
  const closeDropdown = useContext(MenuCloseContext);

  if (disabled) {
    return (
      <span
        data-slot="menu-item-navigate"
        className={clsx(styles.item, styles.disabled, className)}
        role="menuitem"
        aria-disabled="true"
      >
        {leftIcon && (
          <span data-slot="menu-item-left-icon" className={styles.leftIcon}>
            {leftIcon}
          </span>
        )}
        <span data-slot="menu-item-label" className={styles.label}>
          {label}
        </span>
        <span data-slot="menu-item-right-slot" className={styles.rightSlot}>
          <IconChevronRight data-slot="menu-item-chevron" size={14} />
        </span>
      </span>
    );
  }

  return (
    <Link
      data-slot="menu-item-navigate"
      className={clsx(styles.item, className)}
      to={to}
      onClick={closeDropdown ?? undefined}
      role="menuitem"
    >
      {leftIcon && (
        <span data-slot="menu-item-left-icon" className={styles.leftIcon}>
          {leftIcon}
        </span>
      )}
      <span data-slot="menu-item-label" className={styles.label}>
        {label}
      </span>
      <span data-slot="menu-item-right-slot" className={styles.rightSlot}>
        <IconChevronRight data-slot="menu-item-chevron" size={14} />
      </span>
    </Link>
  );
}
