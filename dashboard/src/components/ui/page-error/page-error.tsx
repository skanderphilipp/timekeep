import { type ReactNode } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconRefresh, IconServerOff } from "@tabler/icons-react";

import { Button } from "../button";
import { Section } from "../section";

import styles from "./page-error.module.scss";

type PageErrorProps = {
  /** A descriptive message. Falls back to a generic "Server unreachable" message. */
  message?: string;
  /** Retry callback. If omitted, no retry button is shown. */
  onRetry?: () => void;
  /** Optional custom icon. Defaults to a server-off icon. */
  icon?: ReactNode;
};

/**
 * Standardized full-section error display for pages.
 *
 * Use this component whenever a page's primary data query fails.
 * Do NOT use `EmptyState` for errors — `EmptyState` is for empty data sets.
 *
 * @example
 * if (error) {
 *   return (
 *     <PageLayout>
 *       <PageBody>
 *         <PageError onRetry={refetch} />
 *       </PageBody>
 *     </PageLayout>
 *   );
 * }
 */
export function PageError({ message, onRetry, icon }: PageErrorProps) {
  const { _ } = useLingui();

  return (
    <Section>
      <div data-slot="page-error" className={styles.container} role="alert">
        <div className={styles.iconWrapper}>
          {icon ?? <IconServerOff size={48} stroke={1.5} />}
        </div>

        <h3 className={styles.title}>
          {_(msg`Server Unreachable`)}
        </h3>

        <p className={styles.description}>
          {message ?? _(msg`Could not connect to the timekeep server. Check that the backend is running and try again.`)}
        </p>

        {onRetry && (
          <div className={styles.action}>
            <Button
              variant="secondary"
              icon={<IconRefresh size={16} />}
              onClick={onRetry}
            >
              {_(msg`Retry`)}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
