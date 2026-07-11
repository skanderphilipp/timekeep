/**
 * Reusable React Error Boundary.
 *
 * Catches unhandled rendering errors in the subtree and displays
 * a user-friendly fallback instead of a white screen of death.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Each route or feature can also have its own boundary for
 * fault isolation — a failing chart shouldn't crash the entire SPA.
 */
import { Component, type ReactNode } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Button, Card, Heading, Text, Banner } from "@/components/ui";

// ── Types ───────────────────────────────────────────────────────────

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Custom fallback. Defaults to the built-in `DefaultErrorFallback`. */
  fallback?: ReactNode;
  /** Called when an error is caught, for logging to your telemetry service. */
  onError?: (error: Error, errorInfo: string) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

// ── Default Fallback ────────────────────────────────────────────────

type DefaultErrorFallbackProps = {
  error: Error | null;
  onReset: () => void;
};

function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps) {
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

          {error && (
            <div style={{ marginTop: "var(--ao-spacing-4)" }}>
              <Banner variant="danger">
                <code style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{error.message}</code>
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
            <Button variant="secondary" onClick={onReset}>
              {_(msg`Try Again`)}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

// ── Boundary Component ──────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const componentStack = errorInfo.componentStack ?? "unknown stack";
    this.props.onError?.(error, componentStack);

    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
