import { clsx } from "clsx";
import { type ReactElement, type ReactNode } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

import styles from "./chart.module.scss";

/**
 * Chart presentation wrapper.
 *
 * Provides title, description, loading/error/empty states, and footer.
 * Does NOT provide sizing — each chart component handles its own dimensions
 * via its internal responsive container.
 */

export type ChartProps = {
  children: ReactElement;
  title?: string;
  description?: string;
  isLoading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  footer?: ReactNode;
};

export function Chart({
  children,
  title,
  description,
  isLoading,
  error,
  isEmpty,
  emptyMessage,
  className,
  footer,
}: ChartProps) {
  const { _ } = useLingui();

  return (
    <div data-slot="chart" className={clsx(styles.chart, className)}>
      {(title || description) && (
        <div data-slot="chart-header" className={styles.header}>
          {title && (
            <h3 data-slot="chart-title" className={styles.title}>
              {title}
            </h3>
          )}
          {description && (
            <p data-slot="chart-description" className={styles.description}>
              {description}
            </p>
          )}
        </div>
      )}

      <div data-slot="chart-body" className={styles.body}>
        {isLoading && (
          <div data-slot="chart-loading" className={styles.stateOverlay}>
            <Spinner size="md" />
          </div>
        )}

        {error && !isLoading && (
          <EmptyState title={_(msg`Failed to load chart data`)} description={error.message} />
        )}

        {isEmpty && !isLoading && !error && (
          <EmptyState
            title={_(msg`No data`)}
            description={emptyMessage ?? _(msg`No data available for this period`)}
          />
        )}

        {!isLoading && !error && !isEmpty && children}
      </div>

      {footer && (
        <div data-slot="chart-footer" className={styles.footer}>
          {footer}
        </div>
      )}
    </div>
  );
}
