import { IconPlus, IconPower } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";

/**
 * Registers contextual commands for the integration endpoints page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the endpoints page, before the global commands.
 */
export function useEndpointsCommands() {
  const { _ } = useLingui();

  useRegisterCommands("settings.endpoints", [
    {
      id: "endpoints-create",
      label: _(msg`Create Endpoint`),
      description: _(msg`Add a new integration endpoint`),
      icon: IconPlus,
      keywords: ["new", "add", "integration", "webhook"],
      scope: { type: "page", pageId: "settings.endpoints" },
      /**
       * TODO(ENTERPRISE): Open endpoint creation form
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should open the create endpoint form.
       * Fix: Open inline form or use side panel to launch create flow.
       */
      action: () => {
        /* Placeholder: open create form */
      },
    },
    {
      id: "endpoints-toggle",
      label: _(msg`Toggle Endpoint`),
      description: _(msg`Enable or disable an integration endpoint`),
      icon: IconPower,
      keywords: ["enable", "disable", "toggle", "active"],
      scope: { type: "page", pageId: "settings.endpoints" },
      /**
       * TODO(ENTERPRISE): Focus first endpoint's toggle switch
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should focus the first endpoint's
       *         enable/disable toggle.
       * Fix: Focus the toggle control for the first endpoint in the list.
       */
      action: () => {
        /* Placeholder: focus toggle */
      },
    },
  ]);
}
