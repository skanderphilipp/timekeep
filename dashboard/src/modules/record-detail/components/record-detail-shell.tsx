import type { ReactNode } from "react";
import { useRecordDetailContext } from "../states/record-detail-context";
import { Section, Card, ListLoading } from "@/components/ui";
import styles from "./record-detail.module.scss";

export function RecordDetailShell({ children }: { children: ReactNode }) {
  const { isInSidePanel } = useRecordDetailContext();

  if (isInSidePanel) {
    return (
      <Section data-slot="record-detail-shell" className={styles.shell}>
        {children}
      </Section>
    );
  }

  return (
    <Section>
      <Card>
        <Card.Content>{children}</Card.Content>
      </Card>
    </Section>
  );
}

export function RecordDetailLoading() {
  const { isInSidePanel } = useRecordDetailContext();
  if (isInSidePanel) {
    return (
      <Section data-slot="record-detail-loading" className={styles.statesShell}>
        <ListLoading />
      </Section>
    );
  }
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
