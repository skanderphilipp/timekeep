import type { ReactNode } from "react";

import styles from "./card-grid.module.scss";

type CardGridProps = {
  children: ReactNode;
};

/**
 * Responsive grid layout for card collections.
 *
 * Replaces the recurring raw `<div>` with CSS grid inside a `<Section>`
 * for displaying device cards, metric cards, or any card-based layout.
 *
 * Pages MUST use `<CardGrid>` instead of raw `<div className={styles.grid}>`.
 *
 * @example
 * ```tsx
 * <Section>
 *   <CardGrid>
 *     {devices.map(d => <DeviceCard key={d.serial_number} device={d} />)}
 *   </CardGrid>
 * </Section>
 * ```
 */
export function CardGrid({ children }: CardGridProps) {
  return (
    <div data-slot="card-grid" className={styles.grid}>
      {children}
    </div>
  );
}
