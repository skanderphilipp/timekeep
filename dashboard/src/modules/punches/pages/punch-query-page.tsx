import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PunchQueryView } from "../components/punch-query-view";
import { usePunchQueryCommands } from "../hooks/use-punch-query-commands";
import { PageShell, PageHeader } from "@/components/layout";

export function PunchQueryPage() {
  const { _ } = useLingui();
  usePunchQueryCommands();

  return (
    <PageShell>
      <PageHeader
        title={_(msg`Punch Records`)}
        description={_(msg`Query and filter all attendance punch records.`)}
      />
      <PunchQueryView />
    </PageShell>
  );
}
