import { clsx } from "clsx";
import { type Icon as TablerIcon, IconX } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "./tag.module.scss";

/**
 * Color palette for tags, mapped to our semantic status colors.
 */
import type { StatusColor } from "@/types/status-color";

export type TagColor = StatusColor;

export type TagVariant = "solid" | "outline";
export type TagWeight = "regular" | "medium";

const COLOR_CLASS: Record<TagColor, string> = {
  gray: styles.gray,
  red: styles.red,
  green: styles.green,
  amber: styles.amber,
  blue: styles.blue,
  accent: styles.accent,
};

export type TagProps = {
  /** Display text. */
  text: string;
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
  className?: string;
};

/**
 * Compact color-coded tag for categorisation and filtering.
 *
 * Supports solid (filled) and outline variants across our semantic
 * color palette. Can be rendered as a `<span>`, an interactive
 * `<button>` when `onClick` is provided, or a dismissible badge
 * when `dismissible` is set.
 */
export function Tag({
  text,
  color = "gray",
  variant = "solid",
  weight = "regular",
  Icon,
  onClick,
  dismissible = false,
  onRemove,
  className,
}: TagProps) {
  const { _ } = useLingui();
  const classNames = clsx(
    styles.tag,
    COLOR_CLASS[color],
    styles[variant],
    weight === "medium" && styles.medium,
    onClick && styles.interactive,
    dismissible && styles.dismissible,
    className,
  );

  const content = (
    <>
      {Icon && (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={12} />
        </span>
      )}
      <span className={styles.label}>{text}</span>
    </>
  );

  const dismissButton = dismissible && onRemove && (
    <button
      type="button"
      className={styles.dismiss}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={_(msg`Remove ${text}`)}
    >
      <IconX size={12} />
    </button>
  );

  const TagComponent = onClick ? "button" : "span";
  const extraProps = onClick ? { type: "button" as const, onClick } : {};

  return (
    <TagComponent
      data-slot="tag"
      data-color={color}
      data-variant={variant}
      className={classNames}
      {...extraProps}
    >
      {content}
      {dismissButton}
    </TagComponent>
  );
}
