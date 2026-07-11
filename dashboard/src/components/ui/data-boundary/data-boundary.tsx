import { type ReactNode } from "react";

import { PageError } from "../page-error";
import { Spinner } from "../spinner";
import { EmptyState } from "../empty-state";
import { Section } from "../section";

// ── Types ──────────────────────────────────────────────────────────────────

type DataBoundaryProps<T> = {
  /** The data array. When `undefined`, we're still loading or errored. */
  data: T[] | undefined;
  /** Whether the primary query is loading. */
  isLoading: boolean;
  /** The query error, if any. */
  error: Error | null;
  /** Render prop: called when data is available and non-empty. */
  children: (data: T[]) => ReactNode;
  /** Override the default loading spinner. */
  loadingFallback?: ReactNode;
  /** Override the default error display. */
  errorFallback?: ReactNode;
  /** Override the default empty state. */
  emptyFallback?: ReactNode;
  /** Retry callback — passed to the default error display. */
  onRetry?: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Standardizes the loading → error → empty → data pipeline for list pages.
 *
 * Every page that fetches a list of records should use this component
 * to ensure consistent state handling. Do NOT write manual if/else chains.
 *
 * @example
 * <DataBoundary
 *   data={devices}
 *   isLoading={isLoading}
 *   error={error}
 *   onRetry={refetch}
 *   emptyFallback={<EmptyState title="No devices" />}
 * >
 *   {(devices) => <DeviceList devices={devices} />}
 * </DataBoundary>
 */
export function DataBoundary<T>({
  data,
  isLoading,
  error,
  children,
  loadingFallback,
  errorFallback,
  emptyFallback,
  onRetry,
}: DataBoundaryProps<T>) {
  // Error state — has priority over loading
  if (error) {
    return <>{errorFallback ?? <PageError onRetry={onRetry} />}</>;
  }

  // Loading state — only when no data yet (not background refetch)
  if (isLoading && data === undefined) {
    return <>{loadingFallback ?? <Section><Spinner /></Section>}</>;
  }

  // Empty state
  if (!data || data.length === 0) {
    return <>{emptyFallback ?? <EmptyState title="No data" />}</>;
  }

  // Data state
  return <>{children(data)}</>;
}
