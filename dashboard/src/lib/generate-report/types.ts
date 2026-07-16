import type { Punch, ReportSummary, EmployeeReportKpi } from "@/lib/api";

// ── Report Labels ─────────────────────────────────────────────────────────────

export type ReportLabels = {
  title: string;
  generated: string;
  from: string;
  to: string;
  workspace: string;
  confidential: string;
  page: string;
  of: string;
  summarySection: string;
  workDays: string;
  avgHours: string;
  overtime: string;
  absenceRate: string;
  thisPeriod: string;
  perDay: string;
  total: string;
  punchesSection: string;
  totalPunches: string;
  uniqueUsers: string;
  checkIns: string;
  checkOuts: string;
  date: string;
  time: string;
  userPin: string;
  employee: string;
  deviceSn: string;
  deviceLabel: string;
  status: string;
  verify: string;
  workCode: string;
  employeeKpiSection: string;
  present: string;
  absent: string;
  late: string;
  avgPerDay: string;
  anomalyCount: string;
  chartsSection: string;
};

export const EN_REPORT_LABELS: ReportLabels = {
  title: "Attendance Report",
  generated: "Generated",
  from: "From",
  to: "To",
  workspace: "Workspace",
  confidential: "Confidential",
  page: "Page",
  of: "of",
  summarySection: "Period Summary",
  workDays: "Work Days",
  avgHours: "Avg Hours",
  overtime: "Overtime",
  absenceRate: "Absence Rate",
  thisPeriod: "this period",
  perDay: "per day",
  total: "total",
  punchesSection: "Punch Records",
  totalPunches: "Total Punches",
  uniqueUsers: "Unique Users",
  checkIns: "Check Ins",
  checkOuts: "Check Outs",
  date: "Date",
  time: "Time",
  userPin: "User PIN",
  employee: "Employee",
  deviceSn: "Device SN",
  deviceLabel: "Device",
  status: "Status",
  verify: "Verify",
  workCode: "Work Code",
  employeeKpiSection: "Employee Attendance KPIs",
  present: "Present",
  absent: "Absent",
  late: "Late",
  avgPerDay: "Avg/Day",
  anomalyCount: "Anomalies",
  chartsSection: "Charts",
};

// ── Chart Image ───────────────────────────────────────────────────────────────

export type ChartImage = {
  /** PNG data URL from captureChart(). */
  dataUrl: string;
  /** Section title for the chart. */
  title: string;
  /** Description shown below the title. */
  description?: string;
};

// ── Report Data ───────────────────────────────────────────────────────────────

export type ReportData = {
  /** Workspace/company name — appears in header and footer. */
  workspaceName: string;
  /** Report title override. Falls back to `labels.title`. */
  title?: string;
  /** Date range labels. */
  dateFrom?: string;
  dateTo?: string;
  /** Summary data from the API. */
  summary?: ReportSummary;
  /** Punch records for the table. */
  punches?: Punch[];
  /** Employee KPI data for the employee table. */
  employeeKpis?: EmployeeReportKpi[];
  /** Captured chart images to embed. */
  charts?: ChartImage[];
  /** Translatable strings. Falls back to English defaults. */
  labels?: Partial<ReportLabels>;
  /** BCP 47 locale tag for date/time formatting. */
  locale?: string;
  /** Filename prefix (before the date). */
  filenamePrefix?: string;
};
