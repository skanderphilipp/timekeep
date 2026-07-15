import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { EmptyState } from "@/components/ui";

export function ReportEmpty() {
  const { _ } = useLingui();

  return (
    <EmptyState
      title={_(msg`No data`)}
      description={_(
        msg`No punch records found for the selected date range. Try adjusting the filters.`,
      )}
    />
  );
}
