import { PageShell } from "@/components/layout";
import { EndpointsView } from "../components/endpoints-view";
import { useEndpointsCommands } from "../hooks/use-endpoints-commands";

export function EndpointsPage() {
  useEndpointsCommands();
  return (
    <PageShell>
      <EndpointsView />
    </PageShell>
  );
}
