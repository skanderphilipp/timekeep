import { PageLayout, PageBody } from "@/components/layout";
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
