import { useEffect, useId, type ReactNode } from "react";

import { PageError } from "@/modules/shared/components";
import { ListLoading } from "@/components/ui/list-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { usePageErrorContext } from "@/lib/page-error-context";

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
 * When wrapped in a `<PageShell>`, `DataBoundary` reports its error state
 * to the shell. If ALL boundaries in the subtree report errors, the shell
 * replaces all children with one unified `PageError` — preventing stacked
 * duplicate errors.
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
  const id = useId();
  const { register, reportError } = usePageErrorContext();

  // Register with the nearest PageShell so it can coordinate errors.
  // `register` is stable (useCallback with stable deps), so this
  // effect runs once on mount / cleanup on unmount.
  useEffect(() => {
    const unregister = register(id);
    return unregister;
  }, [register, id]);

  // Report error state changes to the shell.
  // `reportError` is stable (useCallback with stable deps).
  useEffect(() => {
    reportError(id, !!error);
  }, [reportError, id, error]);

  // Error state
  if (error) {
    return <>{errorFallback ?? <PageError onRetry={onRetry} />}</>;
  }

  // Loading state — only when no data yet (not background refetch)
  if (isLoading && data === undefined) {
    return <>{loadingFallback ?? <ListLoading />}</>;
  }

  // Empty state
  if (!data || data.length === 0) {
    return <>{emptyFallback ?? <EmptyState title="No data" />}</>;
  }

  // Data state
  return <>{children(data)}</>;
}
