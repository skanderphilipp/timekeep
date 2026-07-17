import { PageShell } from "@/components/layout";
import { EmployeeListView } from "../components/employee-list-view";
import { useEmployeeListCommands } from "../hooks/use-employee-list-commands";

/**
 * Employee list page — thin composite.
 *
 * Owns the page layout via {@link PageShell}. All content is delegated to {@link EmployeeListView}.
 */
export function EmployeeListPage() {
  useEmployeeListCommands();
  return (
    <PageShell>
      <EmployeeListView />
    </PageShell>
  );
}
