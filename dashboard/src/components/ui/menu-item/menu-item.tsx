import { clsx } from "clsx";
import { type ReactNode, useContext, createContext } from "react";

import styles from "./menu-item.module.scss";

/**
 * Optional context so MenuItem can close its parent dropdown automatically.
 * If no provider exists, MenuItem acts as a standalone button.
 */
export type CloseDropdownFn = () => void;
const MenuCloseContext = createContext<CloseDropdownFn | null>(null);
export { MenuCloseContext };

/**
 * Base menu item — the building block for dropdowns, context menus, and
 * command palettes.
 *
 * Every sub-element has a `data-slot` attribute following Reaktly's
 * convention for grep-based debugging and E2E selectors.
 *
 * When wrapped in a `<Dropdown>`, clicking the item automatically closes
 * the dropdown. Standalone usage (outside a dropdown) skips auto-close.
 */
type MenuItemProps = {
  /** Icon rendered at the leading edge (left in LTR, right in RTL). */
  leftIcon?: ReactNode;
  /** Primary text label. */
  label: string;
  /** Icon or content at the trailing edge. */
  rightIcon?: ReactNode;
  /** Keyboard shortcut hint (e.g. "⌘K"). Displayed muted. */
  hotkey?: string;
  /** Click handler. Dropdown auto-closes after execution. */
  onClick?: () => void;
  /** Disabled state — prevents clicks and dims visuals. */
  disabled?: boolean;
  /** Visual variant. */
  variant?: "default" | "danger";
  /** Additional CSS class. */
  className?: string;
  /** Hover handler (e.g., for keyboard-nav hover sync). */
  onMouseEnter?: () => void;
};

export function MenuItem({
  leftIcon,
  label,
  rightIcon,
  hotkey,
  onClick,
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

  return (
    <button
      data-slot="menu-item"
      data-variant={variant}
      className={clsx(styles.item, styles[variant], disabled && styles.disabled, className)}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      disabled={disabled}
      role="menuitem"
      type="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
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
      </span>
    </button>
  );
}
