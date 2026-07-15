import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  Dialog,
  Form,
  SchemaForm,
  FormActions,
  Button,
  ListLoading,
} from "@/components/ui";
import { useDepartmentForm } from "../hooks/use-department-form";
import { createDepartmentFormDef } from "../schemas/department-form.schema";
import { WorkPolicyForm, DEFAULT_WORK_POLICY } from "@/modules/settings/components/work-policy-form";
import type { WorkPolicy as WorkPolicyType } from "@/lib/api";

type DepartmentFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, edits existing department instead of creating. */
  departmentId?: string;
};

/**
 * Department create/edit modal.
 *
 * Contains:
 *  - Department name (SchemaForm)
 *  - Work policy (WorkPolicyForm)
 *  - Save/Cancel buttons
 *
 * TODO(ENTERPRISE): Wire work_policy into the save mutation.
 * Currently only the name is persisted. The work_policy form is
 * rendered but its value is not sent to the backend.
 *
 * Phase: Department CRUD — work policy persistence
 * Impact: Work policy changes are not saved.
 * Fix: Pass work_policy to createDepartment/updateDepartment calls.
 */
export function DepartmentFormModal({
  open,
  onOpenChange,
  departmentId,
}: DepartmentFormModalProps) {
  const { _ } = useLingui();
  const [workPolicy, setWorkPolicy] = useState<WorkPolicyType>(DEFAULT_WORK_POLICY);

  const handleSaved = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const {
    form,
    isEditing,
    isLoadingDepartment,
    isSaving,
    handleSubmit,
  } = useDepartmentForm(departmentId, handleSaved);

  const formSchema = createDepartmentFormDef(_);
  const modalTitle = isEditing ? _(msg`Edit Department`) : _(msg`Add Department`);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={
        isEditing
          ? _(msg`Update department name and work policy.`)
          : _(msg`Create a new organizational unit.`)
      }
    >
      {isEditing && isLoadingDepartment ? (
        <ListLoading />
      ) : (
        <Form onSubmit={handleSubmit}>
          <SchemaForm formSchema={formSchema} form={form} />

          <WorkPolicyForm
            value={workPolicy}
            onChange={setWorkPolicy}
          />

          <FormActions>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {_(msg`Cancel`)}
            </Button>
            <Button type="submit" loading={isSaving}>
              {isEditing ? _(msg`Save Changes`) : _(msg`Create Department`)}
            </Button>
          </FormActions>
        </Form>
      )}
    </Dialog>
  );
}
