import { PageLayout, PageBody } from "@/components/ui";

import { ApiKeysView } from "../components/api-keys-view";

export function ApiKeysPage() {
  return (
    <PageLayout>
      <PageBody>
        <ApiKeysView />
      </PageBody>
    </PageLayout>
  );
}
