import { type ReactNode } from "react";

import { Breadcrumb, type BreadcrumbSegment } from "@/components/ui/breadcrumb";
import { Heading } from "@/components/ui/heading";

import styles from "./page-bar.module.scss";

export type { BreadcrumbSegment } from "@/components/ui/breadcrumb";

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
  return (
    <div data-slot="page-bar" className={styles.container}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumb segments={breadcrumbs} />}

      <div className={styles.rowWrapper}>
        <div data-slot="page-bar-row" className={styles.row}>
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
