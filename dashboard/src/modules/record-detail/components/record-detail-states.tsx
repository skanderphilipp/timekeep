import type { ReactNode } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { Section } from "@/components/ui";
import { useRecordDetailContext } from "../states/record-detail-context";
import { RecordDetailLoading, RecordDetailNotFound } from "./record-detail-shell";
import { PageError } from "@/modules/shared/components";
import styles from "./record-detail.module.scss";

type RecordDetailStatesProps = {
  isLoading: boolean;
  error: Error | null;
  record: Record<string, unknown> | null | undefined;
  children: ReactNode;
};

export function RecordDetailStates({
  isLoading,
  error,
  record,
  children,
}: RecordDetailStatesProps) {
  const { _ } = useLingui();
  const { entityType } = useRecordDetailContext();

  if (error) {
    return (
      <RecordDetailError
        message={_(msg`Could not load ${entityType} information.`)}
      />
    );
  }

  if (isLoading) {
    return <RecordDetailLoading />;
  }

  if (!record) {
    return <RecordDetailNotFound />;
  }

  return <>{children}</>;
}

function RecordDetailError({ message }: { message: string }) {
  return (
    <Section data-slot="record-detail-error" className={styles.statesShell}>
      <PageError
        onRetry={() => window.location.reload()}
        message={message}
      />
    </Section>
  );
}
