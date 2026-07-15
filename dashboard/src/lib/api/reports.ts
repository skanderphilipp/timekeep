import { apiGet } from "./client";

// ── Types ──────────────────────────────────────────────────────────────────

/** Matches the Rust `ReportSummaryResponse` DTO. */
export type ReportSummary = {
  date_from: number;
  date_to: number;
  total_punches: number;
  check_ins: number;
  check_outs: number;
  break_outs: number;
  break_ins: number;
  overtime_ins: number;
  overtime_outs: number;
  unique_users: number;
  /** Legacy daily breakdown (simplified). Prefer daily_hours for hours data. */
  daily_breakdown: DailyBreakdown[];
  /** Number of working days in the period (excludes weekends). */
  work_days?: number;
  /** Average seconds worked per employee per day. */
  avg_seconds_per_day?: number;
  /** Total overtime seconds in the period. */
  overtime_seconds?: number;
  /** Absence rate as a percentage (0-100). */
  absence_rate?: number;
  /** Daily hours breakdown with regular + overtime split. */
  daily_hours?: DailyHoursBreakdown[];
  /** Weekly total hours. */
  weekly_hours?: WeeklyHoursBreakdown[];
  /** Attendance status distribution (full/half/absent). */
  status_distribution?: AttendanceDistribution[];
  /** Per-employee attendance KPIs. */
  employees?: EmployeeReportKpi[];
};

/** Daily regular + overtime hours. */
export type DailyHoursBreakdown = {
  /** Unix timestamp (seconds) of day start (midnight UTC). */
  date: number;
  /** Total regular work seconds for the day. */
  regular_seconds: number;
  /** Total overtime seconds for the day. */
  overtime_seconds: number;
};

/** Weekly total hours. */
export type WeeklyHoursBreakdown = {
  /** ISO week number (1-53). */
  week: number;
  /** ISO week year. */
  year: number;
  /** Total work seconds across all employees this week. */
  total_seconds: number;
};

/** Attendance distribution bucket. */
export type AttendanceDistribution = {
  /** Status key: "full", "half", or "absent". */
  status: string;
  /** Number of employee-days with this status. */
  count: number;
  /** Percentage of total employee-days. */
  percentage: number;
};

/** Per-employee attendance KPI for the report period. */
export type EmployeeReportKpi = {
  user_pin: string;
  employee_name?: string | null;
  days_present: number;
  days_absent: number;
  days_late: number;
  /** Average seconds worked per day the employee was present. */
  avg_seconds_per_day: number;
  /** Total overtime seconds for this employee in the period. */
  overtime_seconds: number;
  /** Number of anomalies flagged for this employee in the period. */
  anomaly_count: number;
};

/** Matches the Rust `DailyBreakdown` DTO. */
export type DailyBreakdown = {
  /** Unix timestamp (seconds) of the day start (midnight UTC). */
  date: number;
  /** Total punches for this day. */
  count: number;
};

export type ReportSummaryFilter = {
  /** Unix timestamp (seconds) — start of range (inclusive). */
  date_from?: number;
  /** Unix timestamp (seconds) — end of range (inclusive). */
  date_to?: number;
};

function buildReportParams(f: ReportSummaryFilter): string {
  const params = new URLSearchParams();
  if (f.date_from !== undefined) params.set("date_from", String(f.date_from));
  if (f.date_to !== undefined) params.set("date_to", String(f.date_to));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Get aggregated punch summary for a date range. Requires Viewer+. */
export function fetchReportSummary(filter: ReportSummaryFilter = {}): Promise<ReportSummary> {
  return apiGet<ReportSummary>(`reports/summary${buildReportParams(filter)}`).json();
}
