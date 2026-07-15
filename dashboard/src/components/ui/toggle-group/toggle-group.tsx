import { type ReactNode } from "react";
import { clsx } from "clsx";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";

import styles from "./toggle-group.module.scss";

// ── ToggleGroup (Root) ────────────────────────────────────────────────────────

type ToggleGroupProps = {
  children: ReactNode;
  /** Controlled value — array of pressed toggle values. */
  value?: string[];
  /** Called when the pressed value(s) change. */
  onValueChange?: (value: string[]) => void;
  /** When true, multiple toggles can be pressed simultaneously. @default false */
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * ToggleGroup — a segmented button group for view switchers, filters, toolbars.
 *
 * Built on @base-ui/react/toggle-group. Provides accessible keyboard navigation
 * (arrow keys, Home/End), roving tabindex, and proper ARIA roles.
 *
 * @example
 * <ToggleGroup value={[viewType]} onValueChange={([v]) => setViewType(v)}>
 *   <Toggle value="table">Table</Toggle>
 *   <Toggle value="calendar">Calendar</Toggle>
 * </ToggleGroup>
 */
export function ToggleGroup({
  children,
  value,
  onValueChange,
  multiple = false,
  disabled = false,
  className,
}: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      value={value}
      onValueChange={onValueChange}
      multiple={multiple}
      disabled={disabled}
      className={clsx(styles.group, className)}
    >
      {children}
    </ToggleGroupPrimitive>
  );
}

ToggleGroup.displayName = "ToggleGroup";

// ── Toggle ─────────────────────────────────────────────────────────────────────

type ToggleProps = {
  value: string;
  children: ReactNode;
  /** Optional icon rendered before the label. Inherits the toggle's color. */
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * A toggle button for use inside a `<ToggleGroup>`.
 *
 * When pressed (selected), applies an active background and primary text color.
 * Supports an optional `icon` rendered before the label.
 */
export function Toggle({ value, icon, disabled, className, children }: ToggleProps) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      value={value}
      disabled={disabled}
      className={clsx(styles.toggle, className)}
    >
      {icon && <span data-slot="toggle-icon" className={styles.icon}>{icon}</span>}
      <span data-slot="toggle-label" className={styles.label}>{children}</span>
    </TogglePrimitive>
  );
}

Toggle.displayName = "Toggle";
