import { clsx } from "clsx";
import { IconInfoCircle, type Icon as TablerIcon } from "@tabler/icons-react";

import { Tooltip } from "../tooltip";

import styles from "./info.module.scss";

export type InfoAccent = "default" | "danger";

export type InfoProps = {
  /** Tooltip text shown on hover. */
  text: string;
  /** Color accent. */
  accent?: InfoAccent;
  /** Override the default info circle icon. */
  Icon?: TablerIcon;
  /** Icon size. Defaults to 16. */
  size?: number;
  className?: string;
};

const ACCENT_CLASS: Record<InfoAccent, string> = {
  default: styles.defaultAccent,
  danger: styles.danger,
};

/**
 * Hoverable info icon with tooltip.
 *
 * Thin wrapper around our Tooltip + IconInfoCircle. Use it to provide
 * contextual help or to clarify form fields without cluttering the UI.
 */
export function Info({
  text,
  accent = "default",
  Icon = IconInfoCircle,
  size = 16,
  className,
}: InfoProps) {
  return (
    <Tooltip content={text}>
      <span
        data-slot="info"
        className={clsx(styles.info, ACCENT_CLASS[accent], className)}
        aria-label={text}
      >
        <Icon size={size} />
      </span>
    </Tooltip>
  );
}
