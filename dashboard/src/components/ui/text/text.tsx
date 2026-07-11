import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";

import styles from "./text.module.scss";

export type TextVariant = "body" | "caption" | "label";
export type TextColor = "primary" | "secondary" | "tertiary" | "danger" | "success" | "warning";
export type TextElement = "p" | "span" | "label";

type TextProps = {
  variant?: TextVariant;
  as?: TextElement;
  color?: TextColor;
  children: ReactNode;
  className?: string;
  /** For label variant: the `htmlFor` attribute of the `<label>` element. */
  htmlFor?: string;
  /** Override font weight. Falls back to the variant's default if omitted. */
  weight?: "regular" | "medium";
  style?: CSSProperties;
};

const sizeMap: Record<TextVariant, string> = {
  body: styles.sizeBody,
  caption: styles.sizeCaption,
  label: styles.sizeLabel,
};

const weightMap: Record<TextVariant, string> = {
  body: styles.weightRegular,
  caption: styles.weightRegular,
  label: styles.weightMedium,
};

/**
 * Body text, captions, and form labels.
 *
 * Use instead of raw `<p>`, `<span>`, or `<label>` in pages.
 *
 * - `body`: Standard paragraph text (`--ao-font-size-md`)
 * - `caption`: Small secondary text (`--ao-font-size-sm`)
 * - `label`: Form field label (`--ao-font-size-sm`, medium weight)
 */
export function Text({
  variant = "body",
  as,
  color = "primary",
  children,
  className,
  htmlFor,
  weight,
  style,
}: TextProps) {
  const Tag = as ?? (variant === "label" ? "label" : "p");

  const weightClass = weight === "medium" ? styles.weightMedium : weight === "regular" ? styles.weightRegular : weightMap[variant];

  return (
    <Tag
      data-slot="text"
      data-variant={variant}
      data-color={color}
      className={clsx(
        styles.text,
        sizeMap[variant],
        weightClass,
        styles[color],
        className,
      )}
      htmlFor={htmlFor}
      style={style}
    >
      {children}
    </Tag>
  );
}
