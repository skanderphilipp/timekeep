import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./badge.module.scss";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";
type BadgeSize = "sm" | "md";

type BadgeProps = {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
};

export function Badge({ variant = "neutral", size = "sm", children, className }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={clsx(styles.badge, styles[variant], styles[size], className)}
    >
      {children}
    </span>
  );
}
