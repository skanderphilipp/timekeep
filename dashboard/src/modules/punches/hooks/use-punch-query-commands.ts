import { useNavigate } from "react-router-dom";
import { IconDownload, IconReport } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { AppRoute } from "@/lib/navigation";

/**
 * Registers contextual commands for the punch records page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the punch records page.
 */
export function usePunchQueryCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  useRegisterCommands("punches.list", [
    {
      id: "punch-reports",
      label: _(msg`View Reports`),
      description: _(msg`Open attendance reports and exports`),
      icon: IconReport,
      keywords: ["report", "summary", "export"],
      scope: { type: "page", pageId: "punches.list" },
      action: () => navigate(AppRoute.reports),
    },
    {
      id: "punch-export",
      label: _(msg`Export Punches`),
      description: _(msg`Download punch data as CSV`),
      icon: IconDownload,
      keywords: ["download", "csv", "export"],
      scope: { type: "page", pageId: "punches.list" },
      action: () => navigate(AppRoute.reports),
    },
  ]);
}
