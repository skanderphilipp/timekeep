import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Card } from "../card";
import { Heading } from "../heading";
import { Text } from "../text";

import styles from "./metric-card.module.scss";

export type MetricCardColor = "green" | "red" | "amber" | "accent";

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  /** Optional sub-label (e.g., "of 50" or "this month"). */
  sub?: string;
  /** Color accent for the icon. Defaults to accent (blue). */
  color?: MetricCardColor;
};

/**
 * A single KPI card with icon, label, prominent value, and optional sub-label.
 *
 * Used on Dashboard (Present/Absent/Late/On Time) and Reports
 * (Work Days/Avg Hours/Overtime/Absence Rate). Consistent across pages.
 */
export function MetricCard({ icon, label, value, sub, color = "accent" }: MetricCardProps) {
  const iconClass = clsx(styles.icon, color && styles[color]);

  return (
    <Card>
      <Card.Content className={styles.card}>
        <Text variant="body" className={iconClass} data-slot="metric-icon">
          {icon}
        </Text>
        <Card.Content className={styles.textGroup} data-slot="metric-text">
          <Text variant="caption" color="tertiary">
            {label}
          </Text>
          <Heading level="h3" className={styles.value}>
            {value}
          </Heading>
          {sub && (
            <Text variant="caption" color="tertiary">
              {sub}
            </Text>
          )}
        </Card.Content>
      </Card.Content>
    </Card>
  );
}
