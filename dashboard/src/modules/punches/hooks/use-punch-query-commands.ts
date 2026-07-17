import { useNavigate } from "react-router-dom";
import { IconFileDownload, IconRefresh, IconAlertTriangle, IconPencil } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { AppRoute } from "@/lib/navigation";

/**
 * Registers contextual commands for the punch records (attendance) page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the attendance/punch records page, before the global commands.
 */
export function usePunchQueryCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  useRegisterCommands("attendance.list", [
    {
      id: "punch-export-csv",
      label: _(msg`Export as CSV`),
      description: _(msg`Download punch records as CSV`),
      icon: IconFileDownload,
      keywords: ["export", "csv", "download", "spreadsheet"],
      scope: { type: "page", pageId: "attendance.list" },
      /**
       * TODO(ENTERPRISE): Trigger actual CSV export via fetchPunchExport
       *
       * Phase: Polish (before v1.0)
       * Impact: Command currently opens export route; actual download requires
       *         API call + blob download logic.
       * Fix: Call fetchPunchExport({ format: "csv" }) and trigger browser download
       *       via URL.createObjectURL + anchor click.
       */
      action: () => navigate(AppRoute.reports),
    },
    {
      id: "punch-show-anomalies",
      label: _(msg`Show Anomalies`),
      description: _(msg`Filter to anomalous punch records`),
      icon: IconAlertTriangle,
      keywords: ["anomalies", "errors", "flagged", "suspicious"],
      scope: { type: "page", pageId: "attendance.list" },
      /**
       * TODO(ENTERPRISE): Apply anomaly filter to current punch query
       *
       * Phase: Polish (before v1.0)
       * Impact: Command navigates to attendance page; should set anomalies_only filter param.
       * Fix: Navigate to /attendance?anomalies_only=true or set filter state.
       */
      action: () => navigate(AppRoute.attendance.list),
    },
    {
      id: "punch-correct",
      label: _(msg`Correct Punch`),
      description: _(msg`Manually insert or correct a punch record`),
      icon: IconPencil,
      keywords: ["correct", "fix", "manual", "insert"],
      scope: { type: "page", pageId: "attendance.list" },
      /**
       * TODO(ENTERPRISE): Open punch correction form in side panel
       *
       * Phase: Polish (before v1.0)
       * Impact: Opens attendance list; should open punch correction dialog.
       * Fix: Use useOpenRecordInSidePanel to open a correction form, or
       *       navigate to a dedicated correction route.
       */
      action: () => navigate(AppRoute.attendance.list),
    },
    {
      id: "punch-refresh",
      label: _(msg`Refresh Records`),
      description: _(msg`Reload punch records from server`),
      icon: IconRefresh,
      keywords: ["reload", "refresh"],
      scope: { type: "page", pageId: "attendance.list" },
      action: () => window.location.reload(),
    },
  ]);
}
