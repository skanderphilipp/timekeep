import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { EmptyState } from "@/components/ui";

export function AuditLogEmpty() {
  const { _ } = useLingui();

  return (
    <EmptyState
      title={_(msg`No audit events`)}
      description={_(msg`Audit events will appear here as users perform actions.`)}
    />
  );
}
