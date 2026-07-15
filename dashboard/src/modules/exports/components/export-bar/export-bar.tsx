import { useState, useCallback, useMemo } from "react";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconFileSpreadsheet, IconFileTypeCsv, IconFileTypePdf } from "@tabler/icons-react";

import { Button, Text } from "@/components/ui";
import { useToast } from "@/infrastructure/toast/toast";
import { fetchPunchExport, type Punch, type ReportSummary, type ExportFilter } from "@/lib/api";
import { generatePunchReport, type ReportLabels } from "@/modules/exports/lib/generate-punch-report";
import styles from "./export-bar.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ExportFormat = "csv" | "xlsx" | "pdf";

type ExportBarProps = {
  /** Export filter parameters forwarded to the API. */
  filter: ExportFilter;
  /** Summary data for PDF report header stats. */
  summary?: ReportSummary;
  /** Date labels for the report header. */
  dateFrom?: string;
  dateTo?: string;
  /**
   * Callback to fetch punch records for PDF export.
   * Called when the user clicks the PDF button.
   * Return the punches to include in the report table.
   */
  onFetchPunches?: () => Promise<Punch[]>;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Export action bar — CSV / XLSX / PDF download buttons.
 *
 * CSV and XLSX are fetched server-side via the export API.
 * PDF is generated client-side using jsPDF + jspdf-autotable.
 */
export function ExportBar({
  filter,
  summary,
  dateFrom,
  dateTo,
  onFetchPunches,
  className,
}: ExportBarProps) {
  const { _ } = useLingui();
  const toast = useToast();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const reportLabels = useMemo<ReportLabels>(
    () => ({
      title: _(msg`Attendance Punch Report`),
      generated: _(msg`Generated: `),
      from: _(msg`From: `),
      to: _(msg`To: `),
      totalPunches: _(msg`Total Punches`),
      uniqueUsers: _(msg`Unique Users`),
      checkIns: _(msg`Check Ins`),
      date: _(msg`Date`),
      time: _(msg`Time`),
      userPin: _(msg`User PIN`),
      employee: _(msg`Employee`),
      deviceSn: _(msg`Device SN`),
      status: _(msg`Status`),
      verify: _(msg`Verify`),
      workCode: _(msg`Work Code`),
      confidential: _(msg`timekeep — Confidential`),
      page: _(msg`Page`),
      of: _(msg`of`),
    }),
    [_],
  );

  const locale = useMemo(() => {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }
    return "en";
  }, []);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(format);
      try {
        if (format === "pdf") {
          if (!summary || !onFetchPunches) {
            toast.error(_(msg`No data available for PDF export.`));
            return;
          }
          const punches = await onFetchPunches();
          if (punches.length === 0) {
            toast.error(_(msg`No punch records to export.`));
            return;
          }
          await generatePunchReport({
            summary,
            punches,
            dateFrom,
            dateTo,
            labels: reportLabels,
            locale,
          });
        } else {
          const blob = await fetchPunchExport({ ...filter, format });
          const ext = format === "xlsx" ? "xlsx" : "csv";
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `punches-export.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        }
        toast.success(_(msg`Export downloaded.`));
      } catch {
        toast.error(_(msg`Export failed.`));
      } finally {
        setExporting(null);
      }
    },
    [filter, summary, dateFrom, dateTo, onFetchPunches, toast, _, reportLabels, locale],
  );

  const canExportPdf = !!summary && !!onFetchPunches;

  return (
    <section data-slot="export-bar" className={clsx(styles.bar, className)}>
      <Text variant="caption" color="tertiary" className={styles.label}>
        {_(msg`Export`)}
      </Text>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => handleExport("csv")}
        loading={exporting === "csv"}
        icon={<IconFileTypeCsv size={16} />}
      >
        {_(msg`CSV`)}
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => handleExport("xlsx")}
        loading={exporting === "xlsx"}
        icon={<IconFileSpreadsheet size={16} />}
      >
        {_(msg`Excel`)}
      </Button>

      {/* oxlint-disable-next-line bentech/no-raw-html-elements -- decorative divider, not text */}
      <span data-slot="export-bar-spacer" className={styles.spacer} aria-hidden="true" />

      <Button
        variant="secondary"
        size="sm"
        onClick={() => handleExport("pdf")}
        loading={exporting === "pdf"}
        disabled={!canExportPdf}
        icon={<IconFileTypePdf size={16} />}
      >
        {_(msg`PDF`)}
      </Button>
    </section>
  );
}
