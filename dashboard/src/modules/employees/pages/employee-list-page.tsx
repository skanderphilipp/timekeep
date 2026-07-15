import { PageLayout, PageBody } from "@/components/layout";
import { EmployeeListView } from "../components/employee-list-view";

/**
 * Employee list page — thin composite.
 *
 * Owns the page layout. All content is delegated to {@link EmployeeListView}.
 */
export function EmployeeListPage() {
  return (
    <PageLayout>
      <PageBody>
        <EmployeeListView />
      </PageBody>
    </PageLayout>
  );
}
