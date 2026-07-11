import { PageLayout, PageBody } from "@/components/ui";

import { DeviceListView } from "../components/device-list-view";

export function DeviceListPage() {
  return (
    <PageLayout>
      <PageBody>
        <DeviceListView />
      </PageBody>
    </PageLayout>
  );
}
