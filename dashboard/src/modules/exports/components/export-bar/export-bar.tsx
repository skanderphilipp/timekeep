import { useState, useCallback, useMemo } from "react";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconFileSpreadsheet, IconFileTypeCsv, IconFileTypePdf } from "@tabler/icons-react";

// oxlint-disable bentech/no-raw-html-elements -- pre-existing; utility bar needs basic UI primitives
import { Button, Text } from "@/components/ui";
// oxlint-enable bentech/no-raw-html-elements
import { useToast } from "@/infrastructure/toast/toast";
import { fetchPunchExport, type Punch, type ReportSummary, type ExportFilter, type EmployeeReportKpi } from "@/lib/api";
import { generateReport, type ReportLabels, type ChartImage, EN_REPORT_LABELS } from "@/lib/generate-report";
import { captureChart } from "@/lib/capture-chart";
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
  /** Workspace / company name for the PDF header and footer. */
  workspaceName?: string;
  /** Employee KPI data for the employee attendance table in PDF. */
  employeeKpis?: EmployeeReportKpi[];
  /** CSS selectors for chart containers to capture and embed in the PDF. */
  chartSelectors?: string[];
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Export action bar — CSV / XLSX / PDF download buttons.
 *
 * CSV and XLSX are fetched server-side via the export API.
 * PDF is generated client-side using jsPDF + jspdf-autotable, with optional
 * chart captures and multi-section layout.
 */
export function ExportBar({
  filter,
  summary,
  dateFrom,
  dateTo,
  onFetchPunches,
  workspaceName,
  employeeKpis,
  chartSelectors,
  className,
}: ExportBarProps) {
  const { _ } = useLingui();
  const toast = useToast();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const reportLabels = useMemo<ReportLabels>(
    () => ({
      ...EN_REPORT_LABELS,
      title: _(msg`Attendance Report`),
      generated: _(msg`Generated`),
      from: _(msg`From`),
      to: _(msg`To`),
      workspace: _(msg`Workspace`),
      confidential: _(msg`Confidential`),
      page: _(msg`Page`),
      of: _(msg`of`),
      summarySection: _(msg`Period Summary`),
      workDays: _(msg`Work Days`),
      avgHours: _(msg`Avg Hours`),
      overtime: _(msg`Overtime`),
      absenceRate: _(msg`Absence Rate`),
      thisPeriod: _(msg`this period`),
      perDay: _(msg`per day`),
      total: _(msg`total`),
      punchesSection: _(msg`Punch Records`),
      totalPunches: _(msg`Total Punches`),
      uniqueUsers: _(msg`Unique Users`),
      checkIns: _(msg`Check Ins`),
      checkOuts: _(msg`Check Outs`),
      date: _(msg`Date`),
      time: _(msg`Time`),
      userPin: _(msg`User PIN`),
      employee: _(msg`Employee`),
      deviceSn: _(msg`Device SN`),
      deviceLabel: _(msg`Device`),
      status: _(msg`Status`),
      verify: _(msg`Verify`),
      workCode: _(msg`Work Code`),
      employeeKpiSection: _(msg`Employee Attendance KPIs`),
      present: _(msg`Present`),
      absent: _(msg`Absent`),
      late: _(msg`Late`),
      avgPerDay: _(msg`Avg/Day`),
      anomalyCount: _(msg`Anomalies`),
      chartsSection: _(msg`Charts`),
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
          if (punches.length === 0 && (!employeeKpis || employeeKpis.length === 0)) {
            toast.error(_(msg`No records to export.`));
            return;
          }

          // Capture charts from DOM
          const charts: ChartImage[] = [];
          if (chartSelectors && chartSelectors.length > 0) {
            for (const selector of chartSelectors) {
              try {
                const el = document.querySelector<HTMLElement>(selector);
                if (el) {
                  // oxlint-disable-next-line bentech/no-hardcoded-colors -- PDF canvas background, no token context
                  const dataUrl = await captureChart(el, { scale: 2, backgroundColor: "#ffffff" });
                  const title = el.getAttribute("data-pdf-chart-title") ?? "";
                  const description = el.getAttribute("data-pdf-chart-description") ?? undefined;
                  charts.push({ dataUrl, title, description });
                }
              } catch {
                // Silently skip failed chart captures — don't block the export.
              }
            }
          }

          await generateReport({
            workspaceName: workspaceName ?? "timekeep",
            summary,
            punches: punches.length > 0 ? punches : undefined,
            employeeKpis,
            charts: charts.length > 0 ? charts : undefined,
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
        toast.error(_(msg`Export failed. Please try again.`));
      } finally {
        setExporting(null);
      }
    },
    [
      filter,
      summary,
      dateFrom,
      dateTo,
      onFetchPunches,
      workspaceName,
      employeeKpis,
      chartSelectors,
      toast,
      _,
      reportLabels,
      locale,
    ],
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
