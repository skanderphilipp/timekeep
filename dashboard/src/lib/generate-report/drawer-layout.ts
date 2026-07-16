import type { jsPDF } from "jspdf";
import { BRAND_COLOR, BRAND_DARK, DARK_COLOR, LIGHT_GRAY, BORDER_COLOR, MARGIN, CONTENT_WIDTH } from "./constants";
import type { ReportLabels } from "./types";

// ── Header ────────────────────────────────────────────────────────────────────

export function drawHeader(
  doc: jsPDF,
  workspaceName: string,
  title: string,
  generatedAt: Date,
  startY: number,
  labels: ReportLabels,
  locale: string,
): number {
  // Full-width dark band at very top
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, 297, 5, "F");

  // Workspace name — muted, small, top-right
  doc.setFontSize(7);
  doc.setTextColor(...LIGHT_GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(workspaceName, 297 - MARGIN, startY + 2, { align: "right" });

  // Blue accent bar beside title
  doc.setFillColor(...BRAND_COLOR);
  doc.roundedRect(MARGIN, startY + 5, 3.5, 18, 1.5, 1.5, "F");

  // Title — large, bold
  doc.setFontSize(22);
  doc.setTextColor(...DARK_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN + 8, startY + 18);

  // Timestamp — below title
  const metaY = startY + 26;
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(`${labels.generated}: ${formatDateTime(generatedAt, locale)}`, MARGIN + 8, metaY);

  // Divider line below header
  const divY = metaY + 4;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, divY, MARGIN + CONTENT_WIDTH, divY);

  return divY + 2;
}

// ── Date Range ────────────────────────────────────────────────────────────────

export function drawDateRange(
  doc: jsPDF,
  startY: number,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  labels: ReportLabels,
): number {
  const parts: string[] = [];
  if (dateFrom) parts.push(`${labels.from}: ${dateFrom}`);
  if (dateTo) parts.push(`${labels.to}: ${dateTo}`);
  if (parts.length === 0) return startY;

  const textY = startY + 5;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, startY, 140, 8, 3, 3, "FD");

  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.setFont("helvetica", "italic");
  doc.text(parts.join("    │    "), MARGIN + 4, textY);

  return startY + 12;
}

// ── Section Header ────────────────────────────────────────────────────────────

export function drawSectionHeader(doc: jsPDF, title: string, startY: number): number {
  // Thin accent line above section title
  doc.setFillColor(...BRAND_COLOR);
  doc.roundedRect(MARGIN, startY, CONTENT_WIDTH, 1.5, 1, 1, "F");

  doc.setFontSize(12);
  doc.setTextColor(...DARK_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, startY - 4);

  return startY + 2;
}

// ── Footer ────────────────────────────────────────────────────────────────────

export function applyFooter(
  doc: jsPDF,
  workspaceName: string,
  generatedAt: Date,
  labels: ReportLabels,
  locale: string,
): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.height;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Separator line
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, pageHeight - 12, MARGIN + CONTENT_WIDTH, pageHeight - 12);

    // Left: workspace + confidentiality
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(`${workspaceName}  •  ${labels.confidential}`, MARGIN, pageHeight - 8);

    // Right: page numbers + timestamp
    doc.setFontSize(7);
    doc.text(
      `${labels.page} ${i} ${labels.of} ${pageCount}  |  ${formatDateTime(generatedAt, locale)}`,
      MARGIN + CONTENT_WIDTH,
      pageHeight - 8,
      { align: "right" },
    );
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function formatDateTime(date: Date, locale: string = "en"): string {
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
