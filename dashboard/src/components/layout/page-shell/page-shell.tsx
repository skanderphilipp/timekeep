import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

import { PageLayout } from "../page-layout";
import { PageBody } from "../page-body";
// oxlint-disable-next-line bentech/no-deep-ui-imports
import { PageError } from "@/components/ui/page-error";
// oxlint-disable-next-line bentech/no-deep-ui-imports
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PageErrorContext, type PageErrorContextValue } from "@/lib/page-error-context";
import { pageBreadcrumbLabelAtom } from "@/infrastructure/state";

export { usePageErrorContext } from "@/lib/page-error-context";

// ═══════════════════════════════════════════════════════════════════════
// PageShell — the centralized page layout
// ═══════════════════════════════════════════════════════════════════════

type PageShellProps = {
  children: ReactNode;
  /** Optional header rendered below breadcrumbs — typically `<PageBar>`. */
  header?: ReactNode;
  /**
   * Override the label for the last breadcrumb segment.
   * Use on detail pages where the URL contains an opaque ID
   * but the breadcrumb should show a human-readable name.
   */
  pageLabel?: string;
};

/**
 * Centralized page shell — the ONLY valid page wrapper.
 *
 * **Breadcrumbs:** Derived from the current route and rendered in {@link AppTopBar}
 * (the global shell bar). Detail pages pass `pageLabel` to show a human-readable
 * name instead of a UUID; this label is communicated to the top bar via an atom.
 *
 * **Error coordination:** All `DataBoundary` instances in the subtree
 * report errors to this shell. If ALL boundaries error (server down),
 * one unified `PageError` with a single retry replaces all children.
 *
 * @example
 * // Simple list page:
 * <PageShell>
 *   <FeatureView />
 * </PageShell>
 *
 * // Detail page — breadcrumbs show record name:
 * <PageShell pageLabel={employee.name} header={<PageBar title="Employee" icon={IconUsers} />}>
 *   <EmployeeDetailView employeeId={id} />
 * </PageShell>
 */
export function PageShell({ children, header, pageLabel }: PageShellProps) {
  const [registrations] = useState(() => new Map<string, boolean>());
  const [, forceRender] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  const setPageLabel = useSetAtom(pageBreadcrumbLabelAtom);

  // Communicate the page label to AppTopBar for breadcrumb display
  useEffect(() => {
    setPageLabel(pageLabel);
    return () => setPageLabel(undefined);
  }, [pageLabel, setPageLabel]);

  const register = useCallback(
    (id: string): (() => void) => {
      registrations.set(id, false);
      return () => {
        registrations.delete(id);
        forceRender((n) => n + 1);
      };
    },
    [registrations],
  );

  const reportError = useCallback(
    (id: string, hasError: boolean) => {
      const current = registrations.get(id);
      if (current !== hasError) {
        registrations.set(id, hasError);
        forceRender((n) => n + 1);
      }
    },
    [registrations],
  );

  const allErrored =
    registrations.size > 0 &&
    Array.from(registrations.values()).every(Boolean);

  const handleRetry = useCallback(
    (resetQueryErrors: () => void) => {
      resetQueryErrors();
      setRetryKey((k) => k + 1);
    },
    [],
  );

  const ctx: PageErrorContextValue = useMemo(
    () => ({ register, reportError, allErrored }),
    [register, reportError, allErrored],
  );

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <PageErrorContext.Provider value={ctx}>
          <PageLayout>
            {/* Optional page header (title, icon, description, actions) */}
            {header}

            <PageBody>
              <ErrorBoundary>
                {allErrored ? (
                  <PageError onRetry={() => handleRetry(reset)} />
                ) : (
                  <div key={retryKey} style={{ display: "contents" }}>
                    {children}
                  </div>
                )}
              </ErrorBoundary>
            </PageBody>
          </PageLayout>
        </PageErrorContext.Provider>
      )}
    </QueryErrorResetBoundary>
  );
}
