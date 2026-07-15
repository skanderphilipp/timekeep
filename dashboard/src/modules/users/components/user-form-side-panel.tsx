import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { SidePanelFormContainer } from "@/infrastructure/side-panel/components/side-panel-form-container";
import { Form, SchemaForm } from "@/components/ui";
import { useUserForm } from "../hooks/use-user-form";
import { createUserFormDef } from "../schemas/user-form.schema";

type UserFormSidePanelProps = {
  userId?: string;
  onClose: () => void;
};

/**
 * User form in the side panel — thin wrapper.
 *
 * Delegates to `useUserForm` (shared hook) + `SchemaForm` (UI library).
 * Container shell: `SidePanelFormContainer`.
 *
 * Architecture: hooks are the reusable element. SchemaForm renders the fields.
 * Containers just compose them with their shell (Dialog, SidePanel, Page).
 */
export function UserFormSidePanel({ userId, onClose }: UserFormSidePanelProps) {
  const { _ } = useLingui();
  const isEditing = !!userId;
  const { form, isLoadingUser, isSaving, handleSubmit } = useUserForm(userId, onClose);
  const formSchema = createUserFormDef(_, isEditing);

  return (
    <SidePanelFormContainer
      title={isEditing ? _(msg`Edit User`) : _(msg`Create User`)}
      description={
        isEditing
          ? _(msg`Update dashboard user details.`)
          : _(msg`Add a new dashboard user with role and password.`)
      }
      isLoading={isEditing && isLoadingUser}
      isPending={isSaving}
      onCancel={onClose}
      saveLabel={isEditing ? _(msg`Save Changes`) : _(msg`Create User`)}
    >
      <Form id="side-panel-form" onSubmit={handleSubmit}>
        <SchemaForm
          formSchema={formSchema}
          form={form}
          fieldOverrides={isEditing ? { username: { disabled: true } } : undefined}
        />
      </Form>
    </SidePanelFormContainer>
  );
}

UserFormSidePanel.displayName = "UserFormSidePanel";
