import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { Form, SchemaForm, FormActions, Button, ListLoading } from "@/components/ui";
import { createEmployeeFormDef } from "../schemas/employee-form.schema";
import type { useEmployeeForm } from "../hooks/use-employee-form";

type EmployeeFormViewProps = ReturnType<typeof useEmployeeForm>;

/**
 * Employee form component.
 *
 * Accepts the full form state from {@link useEmployeeForm} (passed down
 * from the page). Delegates all field rendering to {@link SchemaForm},
 * which derives field definitions from the Zod schema + UI metadata in
 * `createEmployeeFormDef`.
 */
export function EmployeeFormView({
  form,
  isEditing,
  isLoadingEmployee,
  isSaving,
  handleSubmit,
}: EmployeeFormViewProps) {
  const { _ } = useLingui();
  const formSchema = createEmployeeFormDef(_);

  if (isEditing && isLoadingEmployee) {
    return <ListLoading />;
  }

  return (
    <Form onSubmit={handleSubmit}>
      <SchemaForm
        formSchema={formSchema}
        form={form}
        fieldOverrides={isEditing ? { pin: { disabled: true } } : undefined}
      />
      <FormActions>
        <Button to={AppRoute.employees.list} variant="secondary">
          {_(msg`Cancel`)}
        </Button>
        <Button type="submit" loading={isSaving}>
          {isEditing ? _(msg`Save Changes`) : _(msg`Add Employee`)}
        </Button>
      </FormActions>
    </Form>
  );
}
