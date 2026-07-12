import { clsx } from "clsx";
import { Link } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "./breadcrumb.module.scss";

export type BreadcrumbSegment = {
  label: string;
  path: string;
};

type BreadcrumbProps = {
  /** Ordered breadcrumb trail. Last segment is rendered as current page. */
  segments: BreadcrumbSegment[];
  className?: string;
};

/**
 * Breadcrumb — standalone navigation landmark for hierarchical page trails.
 *
 * Renders a `<nav>` with `aria-label` set via Lingui i18n. Each segment
 * becomes a clickable `<Link>` (react-router-dom) except the last one,
 * which is marked with `aria-current="page"` and rendered as plain text.
 *
 * Separators (`/`) are rendered between segments with `aria-hidden="true"`.
 */
export function Breadcrumb({ segments, className }: BreadcrumbProps) {
  const { _ } = useLingui();

  if (segments.length === 0) return null;

  return (
    <nav
      data-slot="breadcrumb"
      className={clsx(styles.breadcrumb, className)}
      aria-label={_(msg`Breadcrumb`)}
    >
      {segments.map((crumb, index) => (
        <span
          key={crumb.path}
          className={clsx(
            styles.breadcrumbItem,
            index === segments.length - 1 && styles.breadcrumbItemCurrent,
          )}
        >
          {index > 0 && (
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
          )}
          {index === segments.length - 1 ? (
            <span className={styles.breadcrumbCurrent} aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link to={crumb.path} className={styles.breadcrumbLink}>
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

Breadcrumb.displayName = "Breadcrumb";
