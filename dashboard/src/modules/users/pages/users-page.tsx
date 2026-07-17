import { PageShell } from "@/components/layout";
import { UsersView } from "../components/users-view";
import { useUsersCommands } from "../hooks/use-users-commands";

export function UsersPage() {
  useUsersCommands();
  return (
    <PageShell>
      <UsersView />
    </PageShell>
  );
}
