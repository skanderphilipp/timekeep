import { useParams } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { PageLayout, PageBar, PageBody } from "@/components/layout";
import { EmployeeDetailView } from "../components/employee-detail-view";

/**
 * Employee detail page — thin composite.
 *
 * Extracts the employee ID from the URL, wires it to
 * {@link EmployeeDetailView}, and owns the page chrome.
 */
export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { _ } = useLingui();

  return (
    <PageLayout>
      <PageBar
        title={_(msg`Employee`)}
        breadcrumbs={[
          { label: _(msg`Employees`), path: AppRoute.employees.list },
          { label: _(msg`Detail`), path: AppRoute.employees.detail(id!) },
        ]}
      />
      <PageBody>
        <EmployeeDetailView employeeId={id!} />
      </PageBody>
    </PageLayout>
  );
}
