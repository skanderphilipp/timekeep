import { IconPlus, IconPencil, IconKey } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";

/**
 * Registers contextual commands for the users management page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the users page, before the global commands.
 */
export function useUsersCommands() {
  const { _ } = useLingui();

  useRegisterCommands("settings.users", [
    {
      id: "users-add",
      label: _(msg`Add User`),
      description: _(msg`Create a new dashboard user account`),
      icon: IconPlus,
      keywords: ["new", "create", "account"],
      scope: { type: "page", pageId: "settings.users" },
      /**
       * TODO(ENTERPRISE): Open user creation form in side panel or inline
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should open a create-user form
       *         in the side panel or inline modal.
       * Fix: Use useOpenRecordInSidePanel to open create form, or
       *       trigger the inline form to appear.
       */
      action: () => {
        /* Placeholder: open create form */
      },
    },
    {
      id: "users-edit-role",
      label: _(msg`Edit User Role`),
      description: _(msg`Change a user's role and permissions`),
      icon: IconPencil,
      keywords: ["role", "permissions", "admin", "modify"],
      scope: { type: "page", pageId: "settings.users" },
      /**
       * TODO(ENTERPRISE): Focus first user row for inline editing
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should focus first user row
       *         or open the role edit dropdown.
       * Fix: Focus the first user's role selector in the table.
       */
      action: () => {
        /* Placeholder: focus role editor */
      },
    },
    {
      id: "users-change-password",
      label: _(msg`Change Password`),
      description: _(msg`Change a user's password`),
      icon: IconKey,
      keywords: ["password", "reset", "credentials"],
      scope: { type: "page", pageId: "settings.users" },
      /**
       * TODO(ENTERPRISE): Open password change dialog for selected user
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should open a password change modal.
       * Fix: Trigger the password change form/modal for the first/selected user.
       */
      action: () => {
        /* Placeholder: open password change */
      },
    },
  ]);
}
