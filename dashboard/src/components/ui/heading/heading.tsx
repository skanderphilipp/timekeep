import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";

import styles from "./heading.module.scss";

export type HeadingLevel = "h1" | "h2" | "h3";
export type HeadingColor = "primary" | "secondary";

type HeadingProps = {
  level: HeadingLevel;
  children: ReactNode;
  color?: HeadingColor;
  className?: string;
  style?: CSSProperties;
  /** Optional icon rendered inline before the text. */
  icon?: ReactNode;
};

/**
 * Typographic heading component.
 *
 * Enforces the design token scale. Never use raw `<h1>`–`<h6>` in pages.
 *
 * - `h1`: Page title (`--ao-font-size-2xl`, semibold)
 * - `h2`: Section title (`--ao-font-size-xl`, semibold)
 * - `h3`: Card/tile title (`--ao-font-size-lg`, medium)
 */
export function Heading({
  level,
  children,
  color = "primary",
  className,
  style,
  icon,
}: HeadingProps) {
  const Tag = level;

  return (
    <Tag
      data-slot="heading"
      data-level={level}
      data-color={color}
      className={clsx(
        styles.heading,
        styles[level],
        styles[color],
        icon && styles.withIcon,
        className,
      )}
      style={style}
    >
      {icon}
      {children}
    </Tag>
  );
}
