import { PageLayout, PageBody } from "@/components/layout";
import { EndpointsView } from "../components/endpoints-view";

export function EndpointsPage() {
  return (
    <PageLayout>
      <PageBody>
        <EndpointsView />
      </PageBody>
    </PageLayout>
  );
}
