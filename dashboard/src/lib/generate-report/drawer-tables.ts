import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Punch, EmployeeReportKpi } from "@/lib/api";
import { BRAND_DARK, DARK_COLOR, BORDER_COLOR, CARD_BG, RED, MARGIN } from "./constants";
import type { ReportLabels } from "./types";

// ── Punch Table ───────────────────────────────────────────────────────────────

export function drawPunchTable(
  doc: jsPDF,
  punches: Punch[],
  startY: number,
  labels: ReportLabels,
  locale: string,
): void {
  const sorted = [...punches].sort((a, b) => b.timestamp - a.timestamp);

  const rows = sorted.map((p) => {
    const date = new Date(p.timestamp * 1000);
    return [
      date.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" }),
      date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      p.user_pin,
      p.employee_name || "—",
      p.device_label || p.device_sn,
      capitalizeFirst(p.status),
      capitalizeFirst(p.verify_mode),
      p.work_code || "—",
    ];
  });

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN },
    head: [
      [
        labels.date, labels.time, labels.userPin, labels.employee,
        labels.deviceLabel, labels.status, labels.verify, labels.workCode,
      ],
    ],
    body: rows,
    theme: "plain",
    showHead: "everyPage",
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 3.5,
      lineWidth: 0,
      lineColor: BRAND_DARK,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 3,
      textColor: DARK_COLOR,
      lineWidth: 0.3,
      lineColor: BORDER_COLOR,
    },
    alternateRowStyles: { fillColor: CARD_BG },
    styles: { overflow: "linebreak", cellWidth: "auto" },
    didParseCell: (hookData) => {
      const row = hookData.row;
      if (row?.index !== undefined) {
        const punch = sorted[row.index];
        if (punch?.is_anomaly) {
          hookData.cell.styles.textColor = RED;
          hookData.cell.styles.fontStyle = "italic";
        }
      }
    },
  });
}

// ── Employee KPI Table ────────────────────────────────────────────────────────

export function drawEmployeeKpiTable(
  doc: jsPDF,
  kpis: EmployeeReportKpi[],
  startY: number,
  labels: ReportLabels,
): void {
  const sorted = [...kpis].sort((a, b) =>
    (a.employee_name ?? a.user_pin).localeCompare(b.employee_name ?? b.user_pin),
  );

  const rows = sorted.map((k) => [
    k.employee_name ?? k.user_pin,
    String(k.days_present),
    String(k.days_absent),
    String(k.days_late),
    formatHours(k.avg_seconds_per_day),
    formatHours(k.overtime_seconds),
    k.anomaly_count > 0 ? String(k.anomaly_count) : "—",
  ]);

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN },
    head: [
      [
        labels.employee, labels.present, labels.absent, labels.late,
        labels.avgPerDay, labels.overtime, labels.anomalyCount,
      ],
    ],
    body: rows,
    theme: "plain",
    showHead: "everyPage",
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 3.5,
      lineWidth: 0,
      lineColor: BRAND_DARK,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 3,
      textColor: DARK_COLOR,
      lineWidth: 0.3,
      lineColor: BORDER_COLOR,
    },
    alternateRowStyles: { fillColor: CARD_BG },
    styles: { overflow: "linebreak", cellWidth: "auto" },
    columnStyles: { 0: { cellWidth: 40 } },
    didParseCell: (hookData) => {
      const col = hookData.column.index;
      const row = hookData.row;
      if (row?.index !== undefined && col === 0) {
        const kpi = sorted[row.index];
        if (kpi?.anomaly_count && kpi.anomaly_count > 0) {
          hookData.cell.styles.textColor = RED;
        }
      }
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatHours(seconds: number): string {
  if (seconds <= 0) return "0h";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${hours.toFixed(1)}h`;
}
