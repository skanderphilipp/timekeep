import { clsx } from "clsx";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { ReactNode } from "react";

import { Spinner } from "../spinner";
import { Text } from "../text";
import type { ComponentSize } from "@/lib/constants";

import styles from "./list-loading.module.scss";

type ListLoadingProps = {
  /** Spinner size. Defaults to "lg" for page-level lists. */
  size?: ComponentSize;
  /** Optional descriptive text below the spinner. */
  label?: string;
  /** Optional action or children below the spinner. */
  children?: ReactNode;
  className?: string;
};

/**
 * Standardized loading indicator for list pages.
 *
 * Renders a visually centered spinner with optional label.
 * Used as the `loadingFallback` for `DataBoundary` across all modules.
 *
 * Replaces the per-module `XxxLoading` boilerplate components.
 */
export function ListLoading({ size = "lg", label, children, className }: ListLoadingProps) {
  const { _ } = useLingui();

  return (
    <div data-slot="list-loading" className={clsx(styles.container, className)}>
      <Spinner size={size} />
      {label && (
        <Text variant="caption" color="tertiary">
          {label}
        </Text>
      )}
      {!label && !children && (
        <Text variant="caption" color="tertiary" aria-live="polite">
          {_(msg`Loading…`)}
        </Text>
      )}
      {children}
    </div>
  );
}

ListLoading.displayName = "ListLoading";
