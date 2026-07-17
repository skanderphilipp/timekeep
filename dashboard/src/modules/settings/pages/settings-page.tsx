import { PageShell } from "@/components/layout";
import { SettingsView } from "../components/settings-view";
import { useSettingsCommands } from "../hooks/use-settings-commands";

export function SettingsPage() {
  useSettingsCommands();
  return (
    <PageShell>
      <SettingsView />
    </PageShell>
  );
}
