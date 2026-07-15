import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { Form, SchemaForm, FormActions, Button } from "@/components/ui";
import { useUserForm } from "../hooks/use-user-form";
import { createUserFormDef } from "../schemas/user-form.schema";
import type { DashboardUser } from "@/lib/api";

// ── Props ─────────────────────────────────────────────────────────────────────

type UserFormProps = {
  /** Existing user (edit mode) or undefined (create mode). */
  user?: DashboardUser;
  /** Called after successful create/update. */
  onSuccess?: () => void;
};

/**
 * User form molecule.
 *
 * Delegates all field rendering to {@link SchemaForm}, which derives
 * field definitions from the Zod schema + UI metadata in
 * `createUserFormDef`. The parent page only composes this molecule.
 */
export function UserForm({ user, onSuccess }: UserFormProps) {
  const { _ } = useLingui();
  const isEditing = !!user;
  const { form, isSaving, handleSubmit } = useUserForm(user?.id, onSuccess);

  // Memoize the form schema definition (labels are i18n'd)
  const formSchema = createUserFormDef(_, isEditing);

  return (
    <Form onSubmit={handleSubmit}>
      <SchemaForm
        formSchema={formSchema}
        form={form}
        fieldOverrides={isEditing ? { username: { disabled: true } } : undefined}
      />
      <FormActions>
        <Button to={AppRoute.settings.users} variant="secondary">
          {_(msg`Cancel`)}
        </Button>
        <Button type="submit" loading={isSaving}>
          {isEditing ? _(msg`Save Changes`) : _(msg`Create User`)}
        </Button>
      </FormActions>
    </Form>
  );
}
