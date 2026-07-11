import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./empty-state.module.scss";
import { IconDatabaseOff } from "@tabler/icons-react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className={clsx(styles.container, className)}>
      <div data-slot="empty-state-icon" className={styles.icon}>
        {icon ?? <IconDatabaseOff size={48} stroke={1.5} />}
      </div>
      <h3 data-slot="empty-state-title" className={styles.title}>
        {title}
      </h3>
      {description && (
        <p data-slot="empty-state-description" className={styles.description}>
          {description}
        </p>
      )}
      {action && (
        <div data-slot="empty-state-action" className={styles.action}>
          {action}
        </div>
      )}
    </div>
  );
}
