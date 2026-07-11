import type { ReactNode } from "react";
import { clsx } from "clsx";

import { Section } from "../section/section";
import { Heading } from "../heading/heading";
import { Text } from "../text/text";
import styles from "./page-header.module.scss";

type PageHeaderProps = {
  /** Page title. Rendered as `<Heading level="h2">`. */
  title: string;
  /** Optional description below the title. Rendered as `<Text variant="caption" color="secondary">`. */
  description?: string;
  /** Optional action buttons (right-aligned). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Standard page header — title + description + optional actions.
 *
 * Replaces the recurring `Section > Heading(h2) + Text(caption)` pattern
 * found at the top of every list/detail/settings page.
 *
 * Pages MUST use `<PageHeader>` instead of composing Section/Heading/Text
 * manually. This ensures consistent spacing, typography, and action placement.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title={_(msg`Users`)}
 *   description={_(msg`Manage dashboard users, roles, and passwords.`)}
 *   actions={<Button icon={<IconPlus />}>{_(msg`Add User`)}</Button>}
 * />
 * ```
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <Section className={clsx(styles.header, className)}>
      {actions ? (
        <div data-slot="page-header-row" className={styles.headerWithAction}>
          <div data-slot="page-header-content" className={styles.headerContent}>
            <Heading level="h2">{title}</Heading>
            {description && (
              <Text variant="caption" color="secondary">
                {description}
              </Text>
            )}
          </div>
          <div data-slot="page-header-actions" className={styles.actions}>
            {actions}
          </div>
        </div>
      ) : (
        <>
          <Heading level="h2">{title}</Heading>
          {description && (
            <Text variant="caption" color="secondary">
              {description}
            </Text>
          )}
        </>
      )}
    </Section>
  );
}
