import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./page-body.module.scss";

type PageBodyProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Page-level content container.
 *
 * Wraps all content below the `<PageBar>` header. Provides consistent
 * background, padding, and flex layout matching Reaktly's `PageBody` pattern.
 *
 * Pages should use a single `<PageBody>` as their root element — never raw `<></>`.
 *
 * @example
 * ```tsx
 * export function MyPage() {
 *   return (
 *     <PageBody>
 *       <Section>...</Section>
 *       <Section>...</Section>
 *     </PageBody>
 *   );
 * }
 * ```
 */
export function PageBody({ children, className }: PageBodyProps) {
  return (
    <div data-slot="page-body" className={clsx(styles.body, className)}>
      {children}
    </div>
  );
}
