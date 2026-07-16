import { Section } from "@/components/ui";
import { useRecordDetailContext } from "../states/record-detail-context";
import type { ReactNode } from "react";
import styles from "./record-detail.module.scss";

type RecordDetailActionsProps = {
  children?: ReactNode;
};

/**
 * Actions area (main panel only).
 *
 * Editing is done through inline cell editing on the detail fields —
 * the record title and all fields marked `editable: true` are click-to-edit.
 * No separate "Edit" button needed (Twenty pattern).
 *
 * The `actions` slot is for domain-specific actions that don't fit
 * inline editing (e.g., "Sync to Devices" for employees).
 */
export function RecordDetailActions({ children }: RecordDetailActionsProps) {
  const { isInSidePanel } = useRecordDetailContext();

  if (isInSidePanel) {
    return null;
  }

  if (!children) {
    return null;
  }

  return (
    <Section data-slot="record-detail-actions" className={styles.actionsRow}>
      {children}
    </Section>
  );
}
