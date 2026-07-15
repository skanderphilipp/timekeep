import type { ReactNode } from "react";

import { Heading } from "../heading/heading";
import { OverflowingTextWithTooltip } from "../overflowing-text-with-tooltip/overflowing-text-with-tooltip";
import styles from "./detail-grid.module.scss";

type DetailGridProps = {
  children: ReactNode;
  /** Optional section title shown above the grid rows. */
  title?: string;
};

/**
 * Structured horizontal label-value grid for detail views.
 *
 * Ported from twenty-ui's RecordInlineCell / PropertyBox pattern.
 * Uses a fixed-width label column on the left with the value
 * filling remaining space on the right — instead of the weak
 * vertical label-above-value stack.
 *
 * Pages MUST use `<DetailGrid>` + `<DetailItem>` instead of
 * raw divs with `<Text variant="label">` / `<Text variant="body">`.
 *
 * @example
 * ```tsx
 * <Card>
 *   <Card.Content>
 *     <DetailGrid title="Account">
 *       <DetailItem label="Username">admin</DetailItem>
 *       <DetailItem label="Role">
 *         <Badge variant="success">Administrator</Badge>
 *       </DetailItem>
 *     </DetailGrid>
 *   </Card.Content>
 * </Card>
 * ```
 */
export function DetailGrid({ children, title }: DetailGridProps) {
  return (
    <div data-slot="detail-grid" className={styles.grid}>
      {title && <Heading level="h3">{title}</Heading>}
      <div className={styles.items}>{children}</div>
    </div>
  );
}

type DetailItemProps = {
  /** Label shown in the fixed-width left column. */
  label: string;
  /** Value content. Strings render with overflow tooltip; ReactNodes render directly. */
  children: ReactNode;
  /** Optional icon rendered before the label text (twenty pattern). */
  icon?: ReactNode;
};

/**
 * A single label-value row within `<DetailGrid>`.
 *
 * The label sits in a fixed 100px column on the left using tertiary
 * color. String children get overflow detection + tooltip; JSX children
 * (Badge, Tag, etc.) render inline without tooltip wrapping.
 *
 * @example
 * ```tsx
 * <DetailItem label="Username" icon={<UserIcon />}>admin</DetailItem>
 * <DetailItem label="Status">
 *   <Badge dot="online" variant="success">Connected</Badge>
 * </DetailItem>
 * ```
 */
export function DetailItem({ label, children, icon }: DetailItemProps) {
  return (
    <div data-slot="detail-item" className={styles.item}>
      <div className={styles.label}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <OverflowingTextWithTooltip text={label} displayedMaxRows={1} />
      </div>
      <div className={styles.value}>
        {typeof children === "string" ? (
          <OverflowingTextWithTooltip text={children} displayedMaxRows={1} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
