import { type ReactNode } from "react";
import type { Icon } from "@tabler/icons-react";

import { Heading } from "@/components/ui";

import styles from "./page-bar.module.scss";

type PageBarProps = {
  title: string;
  description?: string;
  /** Domain module icon — rendered before the title. */
  icon?: Icon;
  actions?: ReactNode;
};

/**
 * Page-level header bar — title, icon, description, and actions.
 *
 * Breadcrumbs are NOT rendered here — they're handled centrally by
 * {@link PageShell}, which guarantees a breadcrumb bar on every page
 * that uses it.
 *
 * The background matches the app shell (`page`) so the white content card
 * below creates visual separation.
 */
export function PageBar({ title, description, icon: Icon, actions }: PageBarProps) {
  return (
    <div data-slot="page-bar" className={styles.container}>
      <div className={styles.rowWrapper}>
        <div data-slot="page-bar-row" className={styles.row}>
          {Icon && (
            <span data-slot="page-bar-icon" className={styles.icon}>
              <Icon size={20} />
            </span>
          )}
          <Heading level="h1" data-slot="page-bar-title" className={styles.title}>
            {title}
          </Heading>
          {description && (
            <p data-slot="page-bar-description" className={styles.description}>
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div data-slot="page-bar-actions" className={styles.actions}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
