import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PunchQueryView } from "../components/punch-query-view";
import { PageLayout, PageBody, PageHeader } from "@/components/ui";

export function PunchQueryPage() {
  const { _ } = useLingui();

  return (
    <PageLayout>
      <PageBody>
        <PageHeader
          title={_(msg`Punch Records`)}
          description={_(msg`Query and filter all attendance punch records.`)}
        />
        <PunchQueryView />
      </PageBody>
    </PageLayout>
  );
}
