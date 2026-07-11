import { PageLayout, PageBody } from "@/components/ui";

import { SettingsView } from "../components/settings-view";

export function SettingsPage() {
  return (
    <PageLayout>
      <PageBody>
        <SettingsView />
      </PageBody>
    </PageLayout>
  );
}
