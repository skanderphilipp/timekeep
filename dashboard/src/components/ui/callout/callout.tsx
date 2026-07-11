import { clsx } from "clsx";
import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconCircleX,
  IconCheck,
  IconX,
  type Icon as TablerIcon,
} from "@tabler/icons-react";

import { Button } from "../button";
import { IconButton } from "../icon-button";

import styles from "./callout.module.scss";

export type CalloutVariant = "info" | "warning" | "error" | "success" | "neutral";

const ICON_MAP: Record<CalloutVariant, TablerIcon> = {
  info: IconInfoCircle,
  warning: IconAlertTriangle,
  error: IconCircleX,
  success: IconCheck,
  neutral: IconInfoCircle,
};

export type CalloutProps = {
  variant: CalloutVariant;
  title: string;
  description: string;
  /** Override the default icon per variant. */
  Icon?: TablerIcon;
  /** Optional action button at the bottom. */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Show a close button. Calls onClose when dismissed. */
  closable?: boolean;
  onClose?: () => void;
};

export function Callout({
  variant,
  title,
  description,
  Icon,
  action,
  closable = false,
  onClose,
}: CalloutProps) {
  const { _ } = useLingui();
  const [visible, setVisible] = useState(true);
  const ResolvedIcon = Icon ?? ICON_MAP[variant];

  const handleClose = () => {
    if (!closable) return;
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <div
      data-slot="callout"
      data-variant={variant}
      className={clsx(styles.container, styles[variant])}
      role="alert"
    >
      <div className={styles.header}>
        <span className={clsx(styles.iconContainer, styles[`${variant}Icon`])}>
          <ResolvedIcon size={16} />
        </span>
        <span className={styles.title}>{title}</span>
        {closable && (
          <IconButton accent="tertiary" size="sm" aria-label={_(msg`Close`)} onClick={handleClose}>
            <IconX size={14} />
          </IconButton>
        )}
      </div>

      <div
        className={clsx(styles.descriptionWrapper, action && styles.descriptionWrapperWithAction)}
      >
        <p className={styles.description}>{description}</p>
      </div>

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
