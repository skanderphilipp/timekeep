import { clsx } from "clsx";
import { type Icon as TablerIcon, IconX } from "@tabler/icons-react";
import { type ReactNode } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "./tag.module.scss";

import type { StatusColor } from "@/types/status-color";

export type TagColor = StatusColor;

export type TagVariant = "solid" | "outline";
export type TagWeight = "regular" | "medium";

export type TagProps = {
  /** Display text. */
  text: string;
  /** Optional secondary value (e.g., "is: active" in filter chips). */
  value?: ReactNode;
  /** Color theme. */
  color?: TagColor;
  /** Visual style. */
  variant?: TagVariant;
  /** Font weight. */
  weight?: TagWeight;
  /** Optional leading icon. */
  Icon?: TablerIcon;
  /** Makes the tag interactive (renders as a button). */
  onClick?: () => void;
  /** Shows a dismiss (X) button. */
  dismissible?: boolean;
  /** Called when the dismiss button is clicked. */
  onRemove?: () => void;
  /** Disabled state. */
  disabled?: boolean;
  className?: string;
};

/**
 * Tag — compact color-coded label for categorisation, filtering, and chips.
 *
 * Open UI alignment: "Tag" is the W3C name for content labels, filter chips,
 * and attribute badges. This single component replaces four former independent
 * implementations (MultiSelect chips, FilterDropdown chips, FilterBar chips,
 * ViewBar chips).
 *
 * Modes:
 * - **Default**: `<span>` with semantic color (solid/outline).
 * - **Interactive**: `<button>` when `onClick` is provided.
 * - **Dismissible**: trailing X button when `dismissible` + `onRemove`.
 * - **With value**: secondary text after the label (e.g., filter values).
 */
export function Tag({
  text,
  value,
  color = "gray",
  variant = "solid",
  weight = "regular",
  Icon,
  onClick,
  dismissible = false,
  onRemove,
  disabled = false,
  className,
}: TagProps) {
  const { _ } = useLingui();

  const classNames = clsx(
    styles.tag,
    onClick && styles.interactive,
    dismissible && styles.dismissible,
    className,
  );

  const sharedAttrs = {
    "data-slot": "tag",
    "data-color": color,
    "data-variant": variant,
    "data-weight": weight,
    "data-interactive": onClick ? true : undefined,
    "data-dismissible": dismissible || undefined,
    "data-disabled": disabled || undefined,
    className: classNames,
  };

  const content = (
    <>
      {Icon && (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={12} />
        </span>
      )}
      <span className={styles.label}>{text}</span>
      {value && <span className={styles.value}>{value}</span>}
    </>
  );

  const dismissButton = dismissible && onRemove && (
    <button
      type="button"
      className={styles.dismiss}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={_(msg`Remove ${text}`)}
    >
      <IconX size={12} />
    </button>
  );

  if (onClick) {
    return (
      <button type="button" {...sharedAttrs} onClick={onClick} disabled={disabled}>
        {content}
        {dismissButton}
      </button>
    );
  }

  return (
    <span {...sharedAttrs}>
      {content}
      {dismissButton}
    </span>
  );
}

Tag.displayName = "Tag";
