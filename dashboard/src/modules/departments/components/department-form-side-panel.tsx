import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { SidePanelFormContainer } from "@/infrastructure/side-panel/components/side-panel-form-container";
import { Form, SchemaForm } from "@/components/ui";
import { useDepartmentForm } from "../hooks/use-department-form";
import { createDepartmentFormDef } from "../schemas/department-form.schema";
import { WorkPolicyForm, DEFAULT_WORK_POLICY } from "@/modules/settings/components/work-policy-form";
import type { WorkPolicy as WorkPolicyType } from "@/lib/api";

type DepartmentFormSidePanelProps = {
  departmentId?: string;
  onClose: () => void;
};

/**
 * Department form in the side panel — thin wrapper.
 *
 * Delegates to `useDepartmentForm` (shared hook) + `SchemaForm` (UI library).
 * Composes `WorkPolicyForm` inline since it's domain-specific UI.
 */
export function DepartmentFormSidePanel({ departmentId, onClose }: DepartmentFormSidePanelProps) {
  const { _ } = useLingui();
  const [workPolicy, setWorkPolicy] = useState<WorkPolicyType>(DEFAULT_WORK_POLICY);
  const { form, isEditing, isLoadingDepartment, isSaving, handleSubmit } =
    useDepartmentForm(departmentId, onClose);
  const formSchema = createDepartmentFormDef(_);

  return (
    <SidePanelFormContainer
      title={isEditing ? _(msg`Edit Department`) : _(msg`Add Department`)}
      description={
        isEditing
          ? _(msg`Update department name and work policy.`)
          : _(msg`Create a new organizational unit.`)
      }
      isLoading={isEditing && isLoadingDepartment}
      isPending={isSaving}
      onCancel={onClose}
      saveLabel={isEditing ? _(msg`Save Changes`) : _(msg`Create Department`)}
    >
      <Form id="side-panel-form" onSubmit={handleSubmit}>
        <SchemaForm formSchema={formSchema} form={form} />
        <WorkPolicyForm value={workPolicy} onChange={setWorkPolicy} />
      </Form>
    </SidePanelFormContainer>
  );
}

DepartmentFormSidePanel.displayName = "DepartmentFormSidePanel";
