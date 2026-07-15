/**
 * Reusable React Error Boundary — built on `react-error-boundary`.
 *
 * Catches unhandled rendering errors in the subtree and displays
 * a user-friendly fallback instead of a white screen of death.
 *
 * Each route or feature can have its own boundary for
 * fault isolation — a failing chart shouldn't crash the entire SPA.
 *
 * @example
 * ```tsx
 * <ErrorBoundary onError={(error, info) => logger.error(error, info)}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
import { type ReactNode } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Banner } from "@/components/ui/banner";

// ── Types ────────────────────────────────────────────────────────────────────

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Custom fallback. Defaults to the built-in `DefaultErrorFallback`. */
  fallback?: ReactNode;
  /** Called when an error is caught, for logging to your telemetry service. */
  onError?: (error: Error, errorInfo: string) => void;
};

// ── Default Fallback ─────────────────────────────────────────────────────────

type FallbackProps = {
  error: unknown;
  resetErrorBoundary: () => void;
};

function DefaultErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const { _ } = useLingui();

  return (
    <div
      data-slot="error-boundary-fallback"
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "var(--ao-spacing-4)",
        backgroundColor: "var(--ao-background-primary)",
      }}
    >
      <Card style={{ maxWidth: 480, width: "100%" }}>
        <Card.Content style={{ textAlign: "center" }}>
          <span
            style={{
              fontSize: "3rem",
              display: "block",
              marginBottom: "var(--ao-spacing-4)",
            }}
          >
            ⚠️
          </span>

          <Heading level="h1">{_(msg`Something went wrong`)}</Heading>

          <div style={{ marginTop: "var(--ao-spacing-2)" }}>
            <Text variant="body" color="secondary">
              {_(msg`An unexpected error occurred. Please try refreshing the page.`)}
            </Text>
          </div>

          {error != null && (
            <div style={{ marginTop: "var(--ao-spacing-4)" }}>
              <Banner variant="danger" title={_(msg`Error Details`)}>
                <code style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{errorMessage}</code>
              </Banner>
            </div>
          )}

          <div
            style={{
              marginTop: "var(--ao-spacing-6)",
              display: "flex",
              gap: "var(--ao-spacing-2)",
              justifyContent: "center",
            }}
          >
            <Button variant="primary" onClick={() => window.location.reload()}>
              {_(msg`Refresh Page`)}
            </Button>
            <Button variant="secondary" onClick={resetErrorBoundary}>
              {_(msg`Try Again`)}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

// ── Boundary Component ───────────────────────────────────────────────────────

export function ErrorBoundary({ children, fallback, onError }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback ? () => <>{fallback}</> : DefaultErrorFallback}
      onError={(error, info) => {
        const componentStack = info.componentStack ?? "unknown stack";
        onError?.(error instanceof Error ? error : new Error(String(error)), componentStack);

        if (import.meta.env.DEV) {
          console.error("[ErrorBoundary]", error, componentStack);
        }
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

ErrorBoundary.displayName = "ErrorBoundary";
