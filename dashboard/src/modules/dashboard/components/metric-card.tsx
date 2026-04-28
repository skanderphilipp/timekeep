import type { ReactNode } from "react";
import { Card, Heading, Text } from "@/components/ui";
import styles from "./metric-card.module.scss";

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  /** Optional sub-label (e.g., "of 50" or "this month"). */
  sub?: string;
  /** Color accent for the icon. Defaults to accent (blue). */
  color?: "green" | "red" | "amber" | "accent";
};

export function MetricCard({ icon, label, value, sub }: MetricCardProps) {
  return (
    <Card>
      <Card.Content className={styles.card}>
        <Text variant="body" className={styles.icon} data-slot="metric-icon">
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
