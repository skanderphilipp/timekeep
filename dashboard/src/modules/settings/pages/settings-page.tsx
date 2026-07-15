import { PageLayout, PageBody } from "@/components/layout";
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
