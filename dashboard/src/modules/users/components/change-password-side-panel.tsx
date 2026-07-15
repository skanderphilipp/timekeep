import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { SidePanelFormContainer } from "@/infrastructure/side-panel/components/side-panel-form-container";
import { Form, SchemaForm } from "@/components/ui";
import { useZodForm } from "@/lib/form";
import { useToast } from "@/infrastructure/toast/toast";
import {
  createChangePasswordSchema,
  createChangePasswordFormDef,
  type ChangePasswordFormValues,
} from "../schemas/change-password-form.schema";
import type { DashboardUser } from "@/lib/api";

type ChangePasswordSidePanelProps = {
  user: DashboardUser;
  onSubmit: (id: string, password: string) => Promise<unknown>;
  onClose: () => void;
};

/**
 * Change password form in the side panel — thin wrapper.
 *
 * Uses the UI library's `SchemaForm` directly. No intermediate *-form-fields component needed.
 *
 * TODO(ENTERPRISE): Extract `useChangePasswordForm` hook for reuse.
 */
export function ChangePasswordSidePanel({ user, onSubmit, onClose }: ChangePasswordSidePanelProps) {
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

  const handleSubmit = form.handleSubmit(async (values: ChangePasswordFormValues) => {
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
  });

  return (
    <SidePanelFormContainer
      title={_(msg`Change Password`)}
      description={_(msg`Set a new password for ${user.display_name || user.username}`)}
      isPending={saving}
      onCancel={handleClose}
      saveLabel={_(msg`Change Password`)}
    >
      <Form id="side-panel-form" onSubmit={handleSubmit}>
        <SchemaForm formSchema={formSchema} form={form} />
      </Form>
    </SidePanelFormContainer>
  );
}

ChangePasswordSidePanel.displayName = "ChangePasswordSidePanel";
