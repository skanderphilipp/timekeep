import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PageError } from "../page-error";

type ListErrorProps = {
  /** The name of the resource that failed to load (e.g. "devices", "API keys"). */
  resource: string;
  /** Retry callback. Passed through to `PageError`. */
  onRetry: () => void;
};

/**
 * Standardized error display for list pages.
 *
 * Wraps `PageError` with an auto-generated i18n message using the resource name.
 * Use as the `errorFallback` for `DataBoundary` across all modules.
 *
 * Replaces the per-module `XxxError` boilerplate components.
 */
export function ListError({ resource, onRetry }: ListErrorProps) {
  const { _ } = useLingui();

  return (
    <PageError
      onRetry={onRetry}
      message={_(msg`Failed to load ${resource}. Check your network connection and try again.`)}
    />
  );
}

ListError.displayName = "ListError";
