import { IconFileDownload, IconFilter, IconUserSearch } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";

/**
 * Registers contextual commands for the audit log page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the audit log page, before the global commands.
 */
export function useAuditCommands() {
  const { _ } = useLingui();

  useRegisterCommands("settings.audit", [
    {
      id: "audit-filter-actor",
      label: _(msg`Filter by Actor`),
      description: _(msg`Show audit events for a specific user`),
      icon: IconUserSearch,
      keywords: ["actor", "user", "who", "performed by"],
      scope: { type: "page", pageId: "settings.audit" },
      /**
       * TODO(ENTERPRISE): Focus the actor filter input
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should focus the actor search input.
       * Fix: Focus the actor filter input field via ref.
       */
      action: () => {
        /* Placeholder: focus actor filter */
      },
    },
    {
      id: "audit-filter-action",
      label: _(msg`Filter by Action`),
      description: _(msg`Show audit events for a specific action type`),
      icon: IconFilter,
      keywords: ["action", "type", "event", "operation"],
      scope: { type: "page", pageId: "settings.audit" },
      /**
       * TODO(ENTERPRISE): Focus the action filter input
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should focus the action filter input.
       * Fix: Focus the action filter input field via ref.
       */
      action: () => {
        /* Placeholder: focus action filter */
      },
    },
    {
      id: "audit-export",
      label: _(msg`Export Audit Log`),
      description: _(msg`Download audit events as CSV`),
      icon: IconFileDownload,
      keywords: ["export", "csv", "download", "save"],
      scope: { type: "page", pageId: "settings.audit" },
      /**
       * TODO(ENTERPRISE): Implement audit log export
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should trigger audit log CSV download.
       * Fix: Call backend export endpoint or build CSV client-side from
       *       fetched audit events, then trigger browser download.
       */
      action: () => {
        /* Placeholder: export audit log */
      },
    },
  ]);
}
