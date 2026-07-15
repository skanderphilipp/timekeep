import { PageShell } from "@/components/layout";
import { EmployeeListView } from "../components/employee-list-view";

/**
 * Employee list page — thin composite.
 *
 * Owns the page layout via {@link PageShell}. All content is delegated to {@link EmployeeListView}.
 */
export function EmployeeListPage() {
  return (
    <PageShell>
      <EmployeeListView />
    </PageShell>
  );
}
