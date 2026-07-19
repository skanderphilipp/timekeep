import { useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  Button,
  Form,
  FormActions,
  Dialog,
  SchemaForm,
} from "@/components/ui";
import { useUserForm } from "../hooks/use-user-form";
import { createUserFormDef } from "../schemas/user-form.schema";

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * User creation dialog.
 *
 * Uses {@link SchemaForm} to render the form from the Zod schema + UI metadata
 * in `createUserFormDef`. Includes password masking, role dropdown, and
 * Zod validation — features the record detail create flow cannot provide.
 *
 * This replaces the record detail side panel create flow for users,
 * which lacked password masking, role selection, and validation.
 */
export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const { _ } = useLingui();
  const { form, isEditing, isSaving, handleSubmit } = useUserForm(undefined, () => {
    onOpenChange(false);
  });

  const formSchema = createUserFormDef(_, isEditing);

  const handleClose = useCallback(() => {
    form.reset();
    onOpenChange(false);
  }, [form, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isSaving) handleClose();
      }}
      title={_(msg`Create User`)}
      description={_(msg`Add a new dashboard user account.`)}
    >
      <Form onSubmit={handleSubmit}>
        <SchemaForm formSchema={formSchema} form={form} />
        <FormActions>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            {_(msg`Cancel`)}
          </Button>
          <Button type="submit" disabled={isSaving} loading={isSaving}>
            {isSaving ? _(msg`Creating…`) : _(msg`Create User`)}
          </Button>
        </FormActions>
      </Form>
    </Dialog>
  );
}
