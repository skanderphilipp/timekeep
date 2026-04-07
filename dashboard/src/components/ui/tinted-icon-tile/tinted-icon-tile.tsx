import { clsx } from "clsx";
import { type Icon as TablerIcon } from "@tabler/icons-react";

import styles from "./tinted-icon-tile.module.scss";

/**
 * Color hint for the tinted tile background and border.
 * Maps to our semantic color tokens.
 */
export type TintedIconTileColor =
  | "accent"
  | "red"
  | "green"
  | "amber"
  | "blue"
  | "neutral";

const COLOR_CLASS: Record<TintedIconTileColor, string> = {
  accent: styles.accent,
  red: styles.red,
  green: styles.green,
  amber: styles.amber,
  blue: styles.blue,
  neutral: styles.neutral,
};

export type TintedIconTileProps = {
  /** The icon to render inside the tile. */
  Icon: TablerIcon;
  /** Color theme for the tile background, border, and icon tint. */
  color?: TintedIconTileColor;
  /** Icon size in pixels. Defaults to 16. */
  size?: number;
  /** Icon stroke width. Defaults to 1.5. */
  stroke?: number;
  className?: string;
};

export function TintedIconTile({
  Icon,
  color = "accent",
  size = 16,
  stroke = 1.5,
  className,
}: TintedIconTileProps) {
  return (
    <span
      data-slot="tinted-icon-tile"
      data-color={color}
      className={clsx(styles.tile, COLOR_CLASS[color], className)}
    >
      <Icon size={size} stroke={stroke} />
    </span>
  );
}
