import { IconUsers } from "@tabler/icons-react";

import { PageShell, PageBar } from "@/components/layout";
import { EmployeeDetailView } from "../components/employee-detail-view";
import { useEmployeeDetailPage } from "../hooks/use-employee-detail-page";

/**
 * Employee detail page — thin composite.
 *
 * All logic (route params, data fetching, label derivation) lives in
 * {@link useEmployeeDetailPage}. The page only wires the result to
 * layout components.
 */
export function EmployeeDetailPage() {
  const page = useEmployeeDetailPage();

  return (
    <PageShell
      pageLabel={page.pageLabel}
      header={
        <PageBar
          title={page.title}
          icon={IconUsers}
        />
      }
    >
      <EmployeeDetailView employeeId={page.id} />
    </PageShell>
  );
}
