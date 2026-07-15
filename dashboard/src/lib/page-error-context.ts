import { createContext, useContext } from "react";

/**
 * Context for coordinating error display between `<PageShell>` and
 * `<DataBoundary>` instances in its subtree.
 *
 * Lives in `lib/` to avoid a circular dependency between
 * `components/layout/` and `modules/shared/`.
 */

export type PageErrorContextValue = {
  /** Register a DataBoundary. Returns unregister function. */
  register: (id: string) => () => void;
  /** Report whether this boundary currently has an error. */
  reportError: (id: string, hasError: boolean) => void;
  /** Whether ALL registered boundaries have errored (server-down signal). */
  allErrored: boolean;
};

const PageErrorContext = createContext<PageErrorContextValue | null>(null);

function noop() {}

/**
 * Hook for `DataBoundary` to report its error state to the nearest `PageShell`.
 *
 * When used outside a `<PageShell>`, returns noop functions —
 * `DataBoundary` falls back to rendering its own error display independently.
 */
export function usePageErrorContext(): PageErrorContextValue {
  const ctx = useContext(PageErrorContext);
  if (!ctx) {
    return { register: () => noop, reportError: noop, allErrored: false };
  }
  return ctx;
}

export { PageErrorContext };
