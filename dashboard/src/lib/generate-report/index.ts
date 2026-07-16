import { jsPDF } from "jspdf";

import { MARGIN } from "./constants";
import { EN_REPORT_LABELS, type ReportLabels, type ReportData } from "./types";
import { drawHeader, drawDateRange, drawSectionHeader, applyFooter } from "./drawer-layout";
import { drawSummaryKpiCards, drawQuickStats } from "./drawer-summary";
import { drawChartSections } from "./drawer-charts";
import { drawPunchTable, drawEmployeeKpiTable } from "./drawer-tables";

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a polished, multi-section PDF report and trigger a browser download.
 *
 * Sections render only when their data is provided:
 * 1. Header — workspace name, title, timestamp, date range
 * 2. Summary KPIs — work days, avg hours, overtime, absence rate
 * 3. Quick stats — total punches, unique users, check-ins, check-outs
 * 4. Charts — embedded PNG images of Nivo charts (2-up grid)
 * 5. Punch records table — auto-width with anomaly highlighting
 * 6. Employee KPI table — per-employee attendance metrics
 * 7. Footer — workspace name, confidentiality, page numbers
 *
 * Uses jsPDF + jspdf-autotable. All text is i18n-configurable via `labels`.
 */
export async function generateReport(data: ReportData): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const labels: ReportLabels = { ...EN_REPORT_LABELS, ...data.labels };
  const locale = data.locale ?? "en";
  const now = new Date();
  let yPos = MARGIN;

  // Header
  yPos = drawHeader(doc, data.workspaceName, data.title ?? labels.title, now, yPos, labels, locale);
  if (data.dateFrom || data.dateTo) {
    yPos = drawDateRange(doc, yPos, data.dateFrom, data.dateTo, labels);
  }
  yPos += 6;

  // Summary KPIs
  if (data.summary) {
    yPos = drawSummaryKpiCards(doc, data.summary, yPos, labels);
    yPos += 6;
  }

  // Quick stats
  if (data.summary) {
    yPos = drawQuickStats(doc, data.summary, yPos, labels);
    yPos += 6;
  }

  // Charts
  if (data.charts && data.charts.length > 0) {
    yPos = drawChartSections(doc, data.charts, yPos);
    yPos += 4;
  }

  // Punch table
  if (data.punches && data.punches.length > 0) {
    yPos = drawSectionHeader(doc, labels.punchesSection, yPos);
    drawPunchTable(doc, data.punches, yPos, labels, locale);
  }

  // Employee KPI table
  if (data.employeeKpis && data.employeeKpis.length > 0) {
    const kpiStartY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? yPos;
    const adjustedY = kpiStartY + 10;
    drawSectionHeader(doc, labels.employeeKpiSection, adjustedY);
    drawEmployeeKpiTable(doc, data.employeeKpis, adjustedY + 10, labels);
  }

  // Footer — applied after all content
  applyFooter(doc, data.workspaceName, now, labels, locale);

  // Download
  const prefix = data.filenamePrefix ?? "attendance-report-";
  doc.save(`${prefix}${formatDateFilename(now)}.pdf`);
}

// ── Barrel ────────────────────────────────────────────────────────────────────

export { type ReportLabels, type ChartImage, type ReportData, EN_REPORT_LABELS } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
