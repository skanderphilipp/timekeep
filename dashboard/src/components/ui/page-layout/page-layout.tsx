import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./page-layout.module.scss";

type PageLayoutProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Single-card page layout wrapper.
 *
 * Every page renders its content inside a single visual card — matching Reaktly's
 * `PageCardLayout` pattern. The card provides:
 * - Clean background (background.primary)
 * - Rounded top-left corner (16px) where it meets the sidebar
 * - Subtle border via box-shadow
 * - Flex column layout for header + body content
 *
 * Pages should NOT nest additional `<Card>` components inside this wrapper.
 * Use `<Section>` for spacing between content blocks.
 */
export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div data-slot="page-layout" className={clsx(styles.card, className)}>
      {children}
    </div>
  );
}
