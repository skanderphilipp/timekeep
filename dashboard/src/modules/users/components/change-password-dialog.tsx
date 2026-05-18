import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  Dialog as DialogComponent,
  Form,
  FormActions,
  Button,
  SchemaForm,
} from "@/components/ui";
import { useZodForm } from "@/lib/form";
import { useToast } from "@/infrastructure/toast/toast";
import {
  createChangePasswordSchema,
  createChangePasswordFormDef,
  type ChangePasswordFormValues,
} from "../schemas/change-password-form.schema";
import type { DashboardUser } from "@/lib/api";

// ── Props ─────────────────────────────────────────────────────────────────────

type ChangePasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  user: DashboardUser;
  onSubmit: (id: string, password: string) => Promise<unknown>;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Change password dialog.
 *
 * Uses {@link SchemaForm} with a single-field Zod schema. No raw useState
 * or manual form handling.
 */
export function ChangePasswordDialog({
  open,
  onClose,
  user,
  onSubmit,
}: ChangePasswordDialogProps) {
  const { _ } = useLingui();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const form = useZodForm(createChangePasswordSchema(_), {
    defaultValues: { password: "" },
  });
  const formSchema = createChangePasswordFormDef(_);

  const handleClose = useCallback(() => {
    form.reset({ password: "" });
    onClose();
  }, [form, onClose]);

  const handleSubmit = form.handleSubmit(
    async (values: ChangePasswordFormValues) => {
      setSaving(true);
      try {
        await onSubmit(user.id, values.password);
        toast.success(_(msg`Password changed.`));
        handleClose();
      } catch {
        toast.error(_(msg`Failed to change password.`));
      } finally {
        setSaving(false);
      }
    },
  );

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) handleClose();
      }}
      title={_(msg`Change Password`)}
      description={_(
        msg`Set a new password for ${user.display_name || user.username}`,
      )}
    >
      <Form onSubmit={handleSubmit}>
        <SchemaForm formSchema={formSchema} form={form} />
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={saving}
          >
            {_(msg`Cancel`)}
          </Button>
          <Button type="submit" disabled={saving} loading={saving}>
            {_(msg`Change Password`)}
          </Button>
        </FormActions>
      </Form>
    </DialogComponent>
  );
}
