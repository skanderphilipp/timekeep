import type { jsPDF } from "jspdf";
import type { ReportSummary } from "@/lib/api";
import { BRAND_COLOR, DARK_COLOR, LIGHT_GRAY, BORDER_COLOR, WHITE, AMBER, RED, MARGIN, CONTENT_WIDTH } from "./constants";
import { drawSectionHeader } from "./drawer-layout";
import type { ReportLabels } from "./types";

// ── Summary KPI Cards ─────────────────────────────────────────────────────────

export function drawSummaryKpiCards(
  doc: jsPDF,
  summary: ReportSummary,
  startY: number,
  labels: ReportLabels,
): number {
  drawSectionHeader(doc, labels.summarySection, startY);
  const cardY = startY + 12;
  const cardHeight = 26;
  const cardWidth = 60;
  const gap = (CONTENT_WIDTH - cardWidth * 4) / 3; // distribute evenly

  const cards: {
    label: string;
    value: string;
    subtitle: string;
    accent: [number, number, number];
  }[] = [
    {
      label: labels.workDays,
      value: String(summary.work_days ?? 0),
      subtitle: labels.thisPeriod,
      accent: BRAND_COLOR,
    },
    {
      label: labels.avgHours,
      value: formatHours(summary.avg_seconds_per_day ?? 0),
      subtitle: labels.perDay,
      accent: BRAND_COLOR,
    },
    {
      label: labels.overtime,
      value: formatHours(summary.overtime_seconds ?? 0),
      subtitle: labels.total,
      accent: AMBER,
    },
    {
      label: labels.absenceRate,
      value: `${(summary.absence_rate ?? 0).toFixed(1)}%`,
      subtitle: labels.thisPeriod,
      accent: RED,
    },
  ];

  let xPos = MARGIN;
  for (const card of cards) {
    // Card background — white with subtle border
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.5);
    doc.roundedRect(xPos, cardY, cardWidth, cardHeight, 4, 4, "FD");

    // Top accent bar
    doc.setFillColor(...card.accent);
    doc.roundedRect(xPos + 0.5, cardY + 0.5, cardWidth - 1, 3, 4, 4, "F");
    // Flatten bottom of accent bar
    doc.setFillColor(...card.accent);
    doc.rect(xPos + 0.5, cardY + 1.5, cardWidth - 1, 2, "F");

    // Label — uppercase-style, small, muted
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont("helvetica", "bold");
    doc.text(card.label.toUpperCase(), xPos + cardWidth / 2, cardY + 10, { align: "center" });

    // Value — large, bold, prominent
    doc.setFontSize(18);
    doc.setTextColor(...DARK_COLOR);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, xPos + cardWidth / 2, cardY + 20, { align: "center" });

    // Subtitle — below value, subtle
    doc.setFontSize(6.5);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(card.subtitle, xPos + cardWidth / 2, cardY + cardHeight - 3, { align: "center" });

    xPos += cardWidth + gap;
  }

  return cardY + cardHeight + 6;
}

// ── Quick Stats Bar ───────────────────────────────────────────────────────────

export function drawQuickStats(
  doc: jsPDF,
  summary: ReportSummary,
  startY: number,
  labels: ReportLabels,
): number {
  const statW = 60;
  const gap = (CONTENT_WIDTH - statW * 4) / 3;
  const rowHeight = 14;

  const stats: { label: string; value: string }[] = [
    { label: labels.totalPunches, value: (summary.total_punches ?? 0).toLocaleString() },
    { label: labels.uniqueUsers, value: (summary.unique_users ?? 0).toLocaleString() },
    { label: labels.checkIns, value: (summary.check_ins ?? 0).toLocaleString() },
    { label: labels.checkOuts, value: (summary.check_outs ?? 0).toLocaleString() },
  ];

  let xPos = MARGIN;
  for (const stat of stats) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.4);
    doc.roundedRect(xPos, startY, statW, rowHeight, 3, 3, "FD");

    doc.setFontSize(7);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(stat.label, xPos + 5, startY + 5.5);

    doc.setFontSize(12);
    doc.setTextColor(...DARK_COLOR);
    doc.setFont("helvetica", "bold");
    doc.text(stat.value, xPos + statW - 5, startY + 5.5, { align: "right" });

    xPos += statW + gap;
  }

  return startY + rowHeight + 6;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function formatHours(seconds: number): string {
  if (seconds <= 0) return "0h";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${hours.toFixed(1)}h`;
}
