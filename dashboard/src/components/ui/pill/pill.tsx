import { clsx } from "clsx";
import { type Icon as TablerIcon } from "@tabler/icons-react";

import styles from "./pill.module.scss";

export type PillProps = {
  /** Text label inside the pill. */
  label?: string;
  /** Optional leading icon. */
  Icon?: TablerIcon;
  className?: string;
};

/**
 * Compact rounded pill badge — typically used for "Soon" labels,
 * feature flags, or compact status indicators.
 *
 * Designed to be inline with other content. Uses `border-radius-pill`
 * for the fully rounded appearance.
 */
export function Pill({ label, Icon, className }: PillProps) {
  return (
    <span data-slot="pill" className={clsx(styles.pill, className)}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {label}
    </span>
  );
}
