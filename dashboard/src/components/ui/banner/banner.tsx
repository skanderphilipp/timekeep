import { clsx } from "clsx";
import {
  IconInfoCircle,
  IconCheck,
  IconAlertTriangle,
  IconX,
  type ReactNode,
} from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./banner.module.scss";

type BannerProps = {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

const iconMap = {
  info: IconInfoCircle,
  success: IconCheck,
  warning: IconAlertTriangle,
  danger: IconX,
};

export function Banner({ variant = "info", title, children, onDismiss, className }: BannerProps) {
  const { _ } = useLingui();
  const Icon = iconMap[variant];

  return (
    <div
      data-slot="banner"
      data-variant={variant}
      className={clsx(styles.banner, styles[variant], className)}
      role="alert"
    >
      <span data-slot="banner-icon" className={styles.icon}>
        <Icon size={18} />
      </span>
      <div data-slot="banner-body" className={styles.body}>
        {title && (
          <span data-slot="banner-title" className={styles.title}>
            {title}
          </span>
        )}
        <span data-slot="banner-text" className={styles.text}>
          {children}
        </span>
      </div>
      {onDismiss && (
        <button
          data-slot="banner-dismiss"
          className={styles.dismiss}
          onClick={onDismiss}
          type="button"
          aria-label={_(msg`Dismiss`)}
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
