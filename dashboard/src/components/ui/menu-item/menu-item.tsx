import { clsx } from "clsx";
import { type ReactNode, useContext, createContext } from "react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";

import styles from "./menu-item.module.scss";

/**
 * Optional context so MenuItem can close its parent dropdown automatically.
 * If no provider exists, MenuItem acts as a standalone button/link.
 */
export type CloseDropdownFn = () => void;
const MenuCloseContext = createContext<CloseDropdownFn | null>(null);
export { MenuCloseContext };

/**
 * MenuItem — universal menu row supporting button and link modes.
 *
 * Open UI alignment: maps to `<menuitem>` (W3C Menu proposal).
   * Transparent-light hover, concentric radius, outline focus.
 *
 * When `to` is provided, renders a `<Link>` with auto-trailing chevron.
 * When `to` is omitted, renders a `<button>`.
 * When wrapped in a `<Dropdown>`, clicking auto-closes the dropdown.
 */
type MenuItemProps = {
  /** Icon rendered at the leading edge. */
  leftIcon?: ReactNode;
  /** Primary text label. */
  label: string;
  /** Icon or content at the trailing edge. */
  rightIcon?: ReactNode;
  /** Keyboard shortcut hint (e.g. "⌘K"). */
  hotkey?: string;
  /** Click handler (button mode). */
  onClick?: () => void;
  /** Route path — switches to link mode with auto chevron. */
  to?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Visual variant. */
  variant?: "default" | "danger";
  /** Additional CSS class. */
  className?: string;
  /** Hover handler (for keyboard-nav sync). */
  onMouseEnter?: () => void;
};

export function MenuItem({
  leftIcon,
  label,
  rightIcon,
  hotkey,
  onClick,
  to,
  disabled = false,
  variant = "default",
  className,
  onMouseEnter,
}: MenuItemProps) {
  const closeDropdown = useContext(MenuCloseContext);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    closeDropdown?.();
  };

  const sharedAttrs = {
    "data-slot": "menu-item",
    "data-variant": variant,
    "data-disabled": disabled || undefined,
    className: clsx(styles.item, className),
    onMouseEnter,
    role: "menuitem" as const,
  };

  const leadingIcon = leftIcon && (
    <span data-slot="menu-item-left-icon" className={styles.leftIcon}>
      {leftIcon}
    </span>
  );

  const labelEl = (
    <span data-slot="menu-item-label" className={styles.label}>
      {label}
    </span>
  );

  const trailingSlot = (
    <span data-slot="menu-item-right-slot" className={styles.rightSlot}>
      {hotkey && (
        <span data-slot="menu-item-hotkey" className={styles.hotkey}>
          {hotkey}
        </span>
      )}
      {rightIcon && (
        <span data-slot="menu-item-right-icon" className={styles.rightIcon}>
          {rightIcon}
        </span>
      )}
      {to && !rightIcon && (
        <IconChevronRight data-slot="menu-item-chevron" size={14} className={styles.chevron} />
      )}
    </span>
  );

  // ── Link mode ────────────────────────────────────────────────────────────

  if (to && !disabled) {
    return (
      <Link {...sharedAttrs} to={to} onClick={closeDropdown ?? undefined}>
        {leadingIcon}
        {labelEl}
        {trailingSlot}
      </Link>
    );
  }

  if (to && disabled) {
    return (
      <span {...sharedAttrs} aria-disabled="true">
        {leadingIcon}
        {labelEl}
        {trailingSlot}
      </span>
    );
  }

  // ── Button mode ──────────────────────────────────────────────────────────

  return (
    <button
      {...sharedAttrs}
      onClick={handleClick}
      disabled={disabled}
      type="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {leadingIcon}
      {labelEl}
      {trailingSlot}
    </button>
  );
}

MenuItem.displayName = "MenuItem";
