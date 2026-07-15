import { PageShell } from "@/components/layout";
import { DepartmentsView } from "../components/departments-view";

/**
 * Departments list page — thin composite.
 */
export function DepartmentsPage() {
  return (
    <PageShell>
      <DepartmentsView />
    </PageShell>
  );
}
