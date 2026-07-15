import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { EmptyState } from "@/components/ui";

export function ApiKeyListEmpty() {
  const { _ } = useLingui();

  return (
    <EmptyState
      title={_(msg`No API keys`)}
      description={_(
        msg`Create an API key to allow external integrations to query attendance data.`,
      )}
    />
  );
}
