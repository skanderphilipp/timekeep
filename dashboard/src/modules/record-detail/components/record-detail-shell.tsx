import type { ReactNode } from "react";
import { useRecordDetailContext } from "../states/record-detail-context";
import { Section, Card, ListLoading } from "@/components/ui";
import styles from "./record-detail.module.scss";

/**
 * Shell that wraps all detail view content.
 *
 * Always uses a Card for consistent layout in both main panel and side panel.
 * CSS custom properties handle any spacing differences between contexts.
 *
 * Architecture: timekeep/.notes/architecture/record-detail-enterprise-plan.md
 */
export function RecordDetailShell({ children }: { children: ReactNode }) {
  return (
    <Section>
      <Card>
        <Card.Content>{children}</Card.Content>
      </Card>
    </Section>
  );
}

export function RecordDetailLoading() {
  return <ListLoading />;
}

export function RecordDetailNotFound() {
  const { entityType } = useRecordDetailContext();
  return (
    <Section data-slot="record-detail-empty" className={styles.emptyState}>
      <p className={styles.emptyTitle}>{entityType} not found</p>
      <p className={styles.emptyDescription}>
        This record may have been removed.
      </p>
    </Section>
  );
}
