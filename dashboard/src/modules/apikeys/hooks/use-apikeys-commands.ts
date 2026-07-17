import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";

/**
 * Registers contextual commands for the API keys page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the API keys page, before the global commands.
 */
export function useApiKeysCommands() {
  const { _ } = useLingui();

  useRegisterCommands("settings.apiKeys", [
    {
      id: "apikeys-create",
      label: _(msg`Create API Key`),
      description: _(msg`Generate a new API key for integrations`),
      icon: IconPlus,
      keywords: ["new", "generate", "token", "integration"],
      scope: { type: "page", pageId: "settings.apiKeys" },
      /**
       * TODO(ENTERPRISE): Open API key creation form
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should open the create API key form
       *         and show the generated key once.
       * Fix: Open inline form or use side panel to launch create flow.
       */
      action: () => {
        /* Placeholder: open create form */
      },
    },
    {
      id: "apikeys-revoke",
      label: _(msg`Revoke API Key`),
      description: _(msg`Revoke an existing API key`),
      icon: IconTrash,
      keywords: ["revoke", "delete", "disable", "remove"],
      scope: { type: "page", pageId: "settings.apiKeys" },
      /**
       * TODO(ENTERPRISE): Focus first key row for revocation
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should focus the first API key's
       *         revoke button or open a confirmation dialog.
       * Fix: Focus revoke button or trigger confirmation modal.
       */
      action: () => {
        /* Placeholder: focus revoke action */
      },
    },
  ]);
}
