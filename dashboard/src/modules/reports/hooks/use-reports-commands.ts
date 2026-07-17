import { IconRefresh, IconFileDownload, IconCalendar } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";

/**
 * Registers contextual commands for the reports page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the reports page, before the global commands.
 */
export function useReportCommands() {
  const { _ } = useLingui();

  useRegisterCommands("reports", [
    {
      id: "reports-export-csv",
      label: _(msg`Export as CSV`),
      description: _(msg`Download attendance report as CSV`),
      icon: IconFileDownload,
      keywords: ["export", "csv", "download", "spreadsheet"],
      scope: { type: "page", pageId: "reports" },
      /**
       * TODO(ENTERPRISE): Trigger actual CSV export via fetchPunchExport
       *
       * Phase: Polish (before v1.0)
       * Impact: Command currently does nothing; should call fetchPunchExport
       *         and trigger browser download.
       * Fix: Call fetchPunchExport({ format: "csv" }) and trigger download
       *       via URL.createObjectURL + anchor click.
       */
      action: () => {
        /* Placeholder: export to be wired */
      },
    },
    {
      id: "reports-export-xlsx",
      label: _(msg`Export as Excel`),
      description: _(msg`Download attendance report as Excel`),
      icon: IconFileDownload,
      keywords: ["export", "xlsx", "excel", "download"],
      scope: { type: "page", pageId: "reports" },
      /**
       * TODO(ENTERPRISE): Trigger actual XLSX export via fetchPunchExport
       *
       * Phase: Polish (before v1.0)
       * Impact: Command currently does nothing; should call fetchPunchExport
       *         and trigger browser download.
       * Fix: Call fetchPunchExport({ format: "xlsx" }) and trigger download.
       */
      action: () => {
        /* Placeholder: export to be wired */
      },
    },
    {
      id: "reports-date-range",
      label: _(msg`Change Date Range`),
      description: _(msg`Adjust the reporting period`),
      icon: IconCalendar,
      keywords: ["date", "range", "period", "filter"],
      scope: { type: "page", pageId: "reports" },
      /**
       * TODO(ENTERPRISE): Focus the date range picker
       *
       * Phase: Polish (before v1.0)
       * Impact: Command does nothing; should focus the date range input
       *         or open the date picker.
       * Fix: Use a ref or state to focus the date range input element.
       */
      action: () => {
        /* Placeholder: focus date range */
      },
    },
    {
      id: "reports-refresh",
      label: _(msg`Refresh Report`),
      description: _(msg`Reload report data from server`),
      icon: IconRefresh,
      keywords: ["reload", "refresh"],
      scope: { type: "page", pageId: "reports" },
      action: () => window.location.reload(),
    },
  ]);
}
