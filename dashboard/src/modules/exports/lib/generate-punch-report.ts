import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Punch, ReportSummary } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReportLabels = {
  title: string;
  generated: string;
  from: string;
  to: string;
  totalPunches: string;
  uniqueUsers: string;
  checkIns: string;
  date: string;
  time: string;
  userPin: string;
  employee: string;
  deviceSn: string;
  status: string;
  verify: string;
  workCode: string;
  confidential: string;
  page: string;
  of: string;
};

const EN_REPORT_LABELS: ReportLabels = {
  title: "Attendance Punch Report",
  generated: "Generated: ",
  from: "From: ",
  to: "To: ",
  totalPunches: "Total Punches",
  uniqueUsers: "Unique Users",
  checkIns: "Check Ins",
  date: "Date",
  time: "Time",
  userPin: "User PIN",
  employee: "Employee",
  deviceSn: "Device SN",
  status: "Status",
  verify: "Verify",
  workCode: "Work Code",
  confidential: "Attendance OS — Confidential",
  page: "Page",
  of: "of",
};

export type PunchReportData = {
  /** Summary stats from the API. */
  summary: ReportSummary;
  /** Raw punch records for the table. */
  punches: Punch[];
  /** Date range filter labels. */
  dateFrom?: string;
  dateTo?: string;
  /** Report title override. */
  title?: string;
  /** Translatable strings. Falls back to English defaults. */
  labels?: Partial<ReportLabels>;
  /** BCP 47 locale tag for date/time formatting. Defaults to `navigator.language`. */
  locale?: string;
  /** Filename prefix (before the date). Defaults to "punches-report-". */
  filenamePrefix?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const BRAND_COLOR = [74, 144, 217] as [number, number, number]; // #4A90D9
const DARK_COLOR = [30, 41, 59] as [number, number, number]; // #1E293B
const LIGHT_GRAY = [100, 116, 139] as [number, number, number]; // #64748B
const BORDER_COLOR = [226, 232, 240] as [number, number, number]; // #E2E8F0

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4
// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a professional PDF punch report and trigger a browser download.
 *
 * Uses jsPDF + jspdf-autotable for layout. The report includes:
 * - Title header with brand color accent
 * - Generation timestamp and date range
 * - Summary statistics (total punches, unique users)
 * - Full punch data table with alternating row colors
 * - Page numbers on every page
 *
 * @example
 * ```ts
 * await generatePunchReport({
 *   summary: reportData,
 *   punches: punchList,
 *   dateFrom: "2026-01-01",
 *   dateTo: "2026-01-31",
 * });
 * ```
 */
export async function generatePunchReport(data: PunchReportData): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const labels: ReportLabels = { ...EN_REPORT_LABELS, ...data.labels };
  const locale = data.locale ?? "en";
  const now = new Date();
  let yPos = MARGIN;

  // ── Header ──────────────────────────────────────────────────────────
  yPos = drawHeader(doc, data.title ?? labels.title, now, yPos, labels);

  // ── Date range ──────────────────────────────────────────────────────
  if (data.dateFrom || data.dateTo) {
    yPos = drawDateRange(doc, yPos, data.dateFrom, data.dateTo, labels);
  }

  // ── Summary cards ───────────────────────────────────────────────────
  yPos = drawSummaryCards(doc, data.summary, yPos, labels);

  // ── Spacer ──────────────────────────────────────────────────────────
  yPos += 8;

  // ── Punch table ─────────────────────────────────────────────────────
  drawPunchTable(doc, data.punches, yPos, labels, locale);

  // ── Footer (page numbers) ───────────────────────────────────────────
  addPageNumbers(doc, now, labels, locale);

  // ── Download ────────────────────────────────────────────────────────
  const prefix = data.filenamePrefix ?? "punches-report-";
  const filename = `${prefix}${formatDateFilename(now)}.pdf`;
  doc.save(filename);
}

// ── Drawing functions ──────────────────────────────────────────────────────────

function drawHeader(
  doc: jsPDF,
  title: string,
  generatedAt: Date,
  startY: number,
  labels: ReportLabels,
): number {
  // Brand accent line
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(MARGIN, startY, 3, 14, "F");

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...DARK_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN + 7, startY + 10);

  // Generation timestamp
  const y = startY + 16;
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${labels.generated}${formatDateTime(generatedAt)}`,
    MARGIN + 7,
    y,
  );

  return y + 4;
}

function drawDateRange(
  doc: jsPDF,
  startY: number,
  dateFrom?: string,
  dateTo?: string,
  labels?: ReportLabels,
): number {
  const parts: string[] = [];
  if (dateFrom) parts.push(`${labels?.from ?? EN_REPORT_LABELS.from}${dateFrom}`);
  if (dateTo) parts.push(`${labels?.to ?? EN_REPORT_LABELS.to}${dateTo}`);

  doc.setFontSize(9);
  doc.setTextColor(...LIGHT_GRAY);
  doc.setFont("helvetica", "italic");
  doc.text(parts.join("  |  "), MARGIN + 7, startY);

  return startY + 6;
}

interface SummaryCard {
  label: string;
  value: string;
  width: number;
}

function drawSummaryCards(
  doc: jsPDF,
  summary: ReportSummary,
  startY: number,
  labels: ReportLabels,
): number {
  const cardY = startY + 4;
  const cardHeight = 18;
  const gap = 6;

  const cards: SummaryCard[] = [
    {
      label: labels.totalPunches,
      value: (summary.total_punches ?? 0).toLocaleString(),
      width: 52,
    },
    {
      label: labels.uniqueUsers,
      value: (summary.unique_users ?? 0).toLocaleString(),
      width: 52,
    },
    {
      label: labels.checkIns,
      value: (summary.check_ins ?? 0).toLocaleString(),
      width: 48,
    },
  ];

  let xPos = MARGIN;
  for (const card of cards) {
    // Card background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.roundedRect(xPos, cardY, card.width, cardHeight, 2, 2, "FD");

    // Label
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(card.label, xPos + 3, cardY + 6);

    // Value
    doc.setFontSize(13);
    doc.setTextColor(...DARK_COLOR);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, xPos + 3, cardY + 14);

    xPos += card.width + gap;
  }

  return cardY + cardHeight + 4;
}

function drawPunchTable(
  doc: jsPDF,
  punches: Punch[],
  startY: number,
  labels: ReportLabels,
  locale: string,
): void {
  const rows = punches.map((p) => [
    new Date(p.timestamp * 1000).toLocaleDateString(locale),
    new Date(p.timestamp * 1000).toLocaleTimeString(locale),
    p.user_pin,
    p.employee_name ?? "—",
    p.device_sn,
    capitalize(p.status),
    capitalize(p.verify_mode),
    p.work_code ?? "—",
  ]);

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN },
    head: [
      [
        labels.date,
        labels.time,
        labels.userPin,
        labels.employee,
        labels.deviceSn,
        labels.status,
        labels.verify,
        labels.workCode,
      ],
    ],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: DARK_COLOR,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 22 }, // Time
      2: { cellWidth: 18 }, // User PIN
      3: { cellWidth: 28 }, // Employee
      4: { cellWidth: 28 }, // Device SN
      5: { cellWidth: 18 }, // Status
      6: { cellWidth: 18 }, // Verify
      7: { cellWidth: 18 }, // Work Code
    },
    didDrawPage: () => {
      // Footer on every page
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(7);
      doc.setTextColor(...LIGHT_GRAY);
      doc.setFont("helvetica", "normal");
      doc.text(
        labels.confidential,
        MARGIN,
        pageHeight - 8,
      );
    },
  });
}

function addPageNumbers(doc: jsPDF, generatedAt: Date, labels: ReportLabels, locale: string): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.height;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${labels.page} ${i} ${labels.of} ${pageCount}  |  ${formatDateTime(generatedAt, locale)}`,
      PAGE_WIDTH - MARGIN,
      pageHeight - 8,
      { align: "right" },
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatDateTime(date: Date, locale: string = "en"): string {
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
