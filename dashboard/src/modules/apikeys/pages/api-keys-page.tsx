import { PageShell } from "@/components/layout";
import { ApiKeysView } from "../components/api-keys-view";
import { useApiKeysCommands } from "../hooks/use-apikeys-commands";

export function ApiKeysPage() {
  useApiKeysCommands();
  return (
    <PageShell>
      <ApiKeysView />
    </PageShell>
  );
}
