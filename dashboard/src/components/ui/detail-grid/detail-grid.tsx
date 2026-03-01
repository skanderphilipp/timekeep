import type { ReactNode } from "react";

import { Heading } from "../heading/heading";
import { Text } from "../text/text";
import styles from "./detail-grid.module.scss";

type DetailGridProps = {
  children: ReactNode;
  /** Optional section title shown above the grid. */
  title?: string;
};

/**
 * Structured label-value grid for detail views.
 *
 * Replaces the recurring raw `<div>` with flex-column + gap inside
 * `Card.Content` for showing key-value metadata.
 *
 * Pages MUST use `<DetailGrid>` + `<DetailItem>` instead of raw divs
 * with `<Text variant="label">` / `<Text variant="body">` pairs.
 *
 * @example
 * ```tsx
 * <Card>
 *   <Card.Content>
 *     <DetailGrid title="Account">
 *       <DetailItem label="Username">admin</DetailItem>
 *       <DetailItem label="Role">Administrator</DetailItem>
 *     </DetailGrid>
 *   </Card.Content>
 * </Card>
 * ```
 */
export function DetailGrid({ children, title }: DetailGridProps) {
  return (
    <div data-slot="detail-grid" className={styles.grid}>
      {title && <Heading level="h3">{title}</Heading>}
      {children}
    </div>
  );
}

type DetailItemProps = {
  /** Label shown above the value. Uses `<Text variant="label">`. */
  label: string;
  /** The value content. Rendered as `<Text variant="body">` by default. */
  children: ReactNode;
};

/**
 * A single label-value pair within a `<DetailGrid>`.
 *
 * @example
 * ```tsx
 * <DetailItem label="Username">admin</DetailItem>
 * <DetailItem label="Role">
 *   <Badge variant="success">admin</Badge>
 * </DetailItem>
 * ```
 */
export function DetailItem({ label, children }: DetailItemProps) {
  return (
    <div data-slot="detail-item" className={styles.item}>
      <Text variant="label">{label}</Text>
      <Text variant="body">{children}</Text>
    </div>
  );
}
