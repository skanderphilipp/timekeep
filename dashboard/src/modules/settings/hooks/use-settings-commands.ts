import { IconPencil, IconHeartRateMonitor } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";

/**
 * Registers contextual commands for the system settings page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the system settings page, before the global commands.
 */
export function useSettingsCommands() {
  const { _ } = useLingui();

  useRegisterCommands("settings.system", [
    {
      id: "settings-edit",
      label: _(msg`Edit System Settings`),
      description: _(msg`Modify poll interval, auto-discover, and work policy defaults`),
      icon: IconPencil,
      keywords: ["config", "modify", "interval", "discovery"],
      scope: { type: "page", pageId: "settings.system" },
      /**
       * TODO(ENTERPRISE): Focus the settings form or open inline editor
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should focus the first editable field
       *         or scroll to the settings form.
       * Fix: Scroll to settings form section via ref or hash navigation.
       */
      action: () => {
        /* Placeholder: focus form */
      },
    },
    {
      id: "settings-health",
      label: _(msg`View System Health`),
      description: _(msg`Check database, engine, and distributor status`),
      icon: IconHeartRateMonitor,
      keywords: ["health", "status", "engine", "db"],
      scope: { type: "page", pageId: "settings.system" },
      /**
       * TODO(ENTERPRISE): Navigate to health tab or show health panel
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should scroll to health section
       *         or open a health detail view.
       * Fix: Navigate to health section or open side panel with health data.
       */
      action: () => {
        /* Placeholder: scroll to health */
      },
    },
  ]);
}
