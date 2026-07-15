import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconUsers } from "@tabler/icons-react";

import { Section } from "@/components/ui";
import { PageShell, PageBar } from "@/components/layout";
import { EmployeeFormView } from "../components/employee-form-view";
import { useEmployeeForm } from "../hooks/use-employee-form";

/**
 * Employee form page — thin composite.
 *
 * Owns the form hook and passes it down to {@link EmployeeFormView}.
 * The page derives layout values (title, description) from hook state.
 */
export function EmployeeFormPage() {
  const { _ } = useLingui();
  const formState = useEmployeeForm();

  const title = formState.isEditing ? _(msg`Edit Employee`) : _(msg`Add Employee`);
  const description = formState.isEditing
    ? _(msg`Update employee information.`)
    : _(msg`Register a new employee in the system.`);

  return (
    <PageShell
      header={<PageBar title={title} description={description} icon={IconUsers} />}
    >
      <Section>
        <EmployeeFormView {...formState} />
      </Section>
    </PageShell>
  );
}
