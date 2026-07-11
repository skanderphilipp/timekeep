import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "./page-bar.module.scss";

export type BreadcrumbSegment = {
  label: string;
  path: string;
};

type PageBarProps = {
  title: string;
  description?: string;
  /** Optional breadcrumbs rendered above the title row (Reaktly pattern). */
  breadcrumbs?: BreadcrumbSegment[];
  actions?: ReactNode;
};

/**
 * Page-level header bar — 1:1 port of Reaktly's PageCardHeader.
 *
 * Single-row flex layout: title on the left, actions on the right.
 * Uses `background.secondary` + `border-bottom: medium` to visually separate
 * the header from the page body content below.
 *
 * Optional breadcrumbs render above the title row (Reaktly pattern).
 */
export function PageBar({ title, description, breadcrumbs, actions }: PageBarProps) {
  const { _ } = useLingui();
  return (
    <div data-slot="page-bar" className={styles.container}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          data-slot="page-bar-breadcrumbs"
          className={styles.breadcrumbs}
          aria-label={_(msg`Breadcrumb`)}
        >
          {breadcrumbs.map((crumb, index) => (
            <span
              key={crumb.path}
              className={clsx(
                styles.breadcrumbItem,
                index === breadcrumbs.length - 1 && styles.breadcrumbItemCurrent,
              )}
            >
              {index > 0 && (
                <span className={styles.breadcrumbSeparator} aria-hidden="true">
                  /
                </span>
              )}
              {index === breadcrumbs.length - 1 ? (
                <span className={styles.breadcrumbCurrent}>{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className={styles.breadcrumbLink}>
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className={styles.rowWrapper}>
        <div data-slot="page-bar-row" className={styles.row}>
          <h1 data-slot="page-bar-title" className={styles.title}>
            {title}
          </h1>
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
