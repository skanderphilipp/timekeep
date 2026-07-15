import { clsx } from "clsx";
import { useState } from "react";
import {
  IconInfoCircle,
  IconCheck,
  IconAlertTriangle,
  IconX,
  type Icon as TablerIcon,
  type ReactNode,
} from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Button } from "../button";
import { IconButton } from "../icon-button";

import styles from "./banner.module.scss";

export type BannerVariant = "info" | "success" | "warning" | "danger" | "neutral";

type BannerProps = {
  variant?: BannerVariant;
  title?: string;
  /** Free-form content (existing Banner API). */
  children?: ReactNode;
  /** Structured description string (Callout compatibility). */
  description?: string;
  /** Override the default icon per variant. */
  Icon?: TablerIcon;
  /** Action button rendered at the bottom of the banner. */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Show a close button with internal visibility tracking. Calls onClose when dismissed. */
  closable?: boolean;
  onClose?: () => void;
  /** Direct dismiss callback (existing Banner API, no internal visibility state). */
  onDismiss?: () => void;
  className?: string;
};

const iconMap: Record<BannerVariant, TablerIcon> = {
  info: IconInfoCircle,
  success: IconCheck,
  warning: IconAlertTriangle,
  danger: IconX,
  neutral: IconInfoCircle,
};

export function Banner({
  variant = "info",
  title,
  children,
  description,
  Icon,
  action,
  closable = false,
  onClose,
  onDismiss,
  className,
}: BannerProps) {
  const { _ } = useLingui();
  const [visible, setVisible] = useState(true);
  const ResolvedIcon = Icon ?? iconMap[variant];

  // Internal close for the closable/closable path
  const handleClose = () => {
    if (!closable) return;
    setVisible(false);
    onClose?.();
  };

  // External dismiss for the direct onDismiss callback
  const handleDismiss = () => {
    onDismiss?.();
  };

  if (closable && !visible) return null;

  const hasBody = !!children || !!description;

  return (
    <div
      data-slot="banner"
      data-variant={variant}
      className={clsx(styles.banner, styles[variant], className)}
      role="alert"
    >
      <div className={styles.header}>
        <span data-slot="banner-icon" className={clsx(styles.icon, styles[`${variant}Icon`])}>
          <ResolvedIcon size={16} />
        </span>
        {title && (
          <span data-slot="banner-title" className={styles.title}>
            {title}
          </span>
        )}
        {closable && (
          <IconButton accent="tertiary" size="sm" aria-label={_(msg`Close`)} onClick={handleClose}>
            <IconX size={14} />
          </IconButton>
        )}
        {!closable && onDismiss && (
          <button
            data-slot="banner-dismiss"
            className={styles.dismiss}
            onClick={handleDismiss}
            type="button"
            aria-label={_(msg`Dismiss`)}
          >
            <IconX size={14} />
          </button>
        )}
      </div>

      {hasBody && (
        <div
          data-slot="banner-body"
          className={clsx(styles.body, action && styles.bodyWithAction)}
        >
          {description && <p className={styles.description}>{description}</p>}
          {children && <span data-slot="banner-text" className={styles.text}>{children}</span>}
        </div>
      )}

      {action && (
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

Banner.displayName = "Banner";
