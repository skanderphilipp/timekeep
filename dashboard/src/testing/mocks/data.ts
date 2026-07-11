/**
 * Rich mock data for Storybook stories and tests.
 *
 * Every mock object matches the Rust API types exactly (see src/lib/api.ts).
 * Import individual mocks where needed — don't import the barrel.
 */

import type {
  TodaySummary,
  CurrentlyCheckedIn,
  DashboardRecentEvent,
  DashboardDeviceHealth,
  DashboardHourlyBreakdown,
  Punch,
  LoginResponse,
  DeviceSummary,
  DeviceConfig,
  UserProfile,
  ReportSummary,
  EmployeeReportKpi,
} from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api-client";
import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";

// ── Time helpers ──────────────────────────────────────────────────────────────

const NOW = () => Math.floor(Date.now() / 1000);
const HOUR = 3600;
const MINUTE = 60;

// ── Dashboard mocks ───────────────────────────────────────────────────────────

export const MOCK_CHECKED_IN_EMPLOYEES: CurrentlyCheckedIn[] = [
  {
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    check_in_time: NOW() - 6 * HOUR - 50 * MINUTE,
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    elapsed_seconds: 6 * HOUR + 50 * MINUTE,
  },
  {
    user_pin: "146",
    employee_name: "Fatima Hassan",
    check_in_time: NOW() - 6 * HOUR - 37 * MINUTE,
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    elapsed_seconds: 6 * HOUR + 37 * MINUTE,
  },
  {
    user_pin: "147",
    employee_name: "Omar Khalid",
    check_in_time: NOW() - 6 * HOUR - 30 * MINUTE,
    device_sn: "BKW8471209384",
    device_label: "Warehouse B",
    elapsed_seconds: 6 * HOUR + 30 * MINUTE,
  },
  {
    user_pin: "148",
    employee_name: "Layla Noor",
    check_in_time: NOW() - 6 * HOUR - 17 * MINUTE,
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    elapsed_seconds: 6 * HOUR + 17 * MINUTE,
  },
  {
    user_pin: "149",
    employee_name: "Bilal Mahmoud",
    check_in_time: NOW() - 5 * HOUR - 45 * MINUTE,
    device_sn: "OFM9928475623",
    device_label: "Office Floor",
    elapsed_seconds: 5 * HOUR + 45 * MINUTE,
  },
  {
    user_pin: "150",
    employee_name: "Noura Al-Rashid",
    check_in_time: NOW() - 5 * HOUR - 10 * MINUTE,
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    elapsed_seconds: 5 * HOUR + 10 * MINUTE,
  },
  {
    user_pin: "151",
    employee_name: "Karim Benali",
    check_in_time: NOW() - 4 * HOUR - 20 * MINUTE,
    device_sn: "BKW8471209384",
    device_label: "Warehouse B",
    elapsed_seconds: 4 * HOUR + 20 * MINUTE,
  },
  {
    user_pin: "152",
    employee_name: "Samira Tazi",
    check_in_time: NOW() - 3 * HOUR - 55 * MINUTE,
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    elapsed_seconds: 3 * HOUR + 55 * MINUTE,
  },
];

export const MOCK_RECENT_EVENTS: DashboardRecentEvent[] = [
  {
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW() - 1 * MINUTE,
    status: "check_in",
    device_sn: "CQZ7232960836",
  },
  {
    user_pin: "147",
    employee_name: "Omar Khalid",
    timestamp: NOW() - 17 * MINUTE,
    status: "check_out",
    device_sn: "BKW8471209384",
  },
  {
    user_pin: "146",
    employee_name: "Fatima Hassan",
    timestamp: NOW() - 30 * MINUTE,
    status: "check_in",
    device_sn: "CQZ7232960836",
  },
  {
    user_pin: "148",
    employee_name: "Layla Noor",
    timestamp: NOW() - 45 * MINUTE,
    status: "break_out",
    device_sn: "CQZ7232960836",
  },
  {
    user_pin: "148",
    employee_name: "Layla Noor",
    timestamp: NOW() - 75 * MINUTE,
    status: "break_in",
    device_sn: "CQZ7232960836",
  },
  {
    user_pin: "150",
    employee_name: "Noura Al-Rashid",
    timestamp: NOW() - 90 * MINUTE,
    status: "check_in",
    device_sn: "CQZ7232960836",
  },
  {
    user_pin: "151",
    employee_name: "Karim Benali",
    timestamp: NOW() - 120 * MINUTE,
    status: "check_in",
    device_sn: "BKW8471209384",
  },
  {
    user_pin: "152",
    employee_name: "Samira Tazi",
    timestamp: NOW() - 140 * MINUTE,
    status: "check_in",
    device_sn: "CQZ7232960836",
  },
  {
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW() - 180 * MINUTE,
    status: "break_out",
    device_sn: "CQZ7232960836",
  },
  {
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW() - 210 * MINUTE,
    status: "break_in",
    device_sn: "CQZ7232960836",
  },
];

export const MOCK_DEVICE_HEALTH: DashboardDeviceHealth[] = [
  {
    serial_number: "CQZ7232960836",
    label: "Main Gate",
    online: true,
    adms_active: true,
    sdk_poll_active: true,
    last_seen_at: NOW() - 30,
    record_count: 45230,
  },
  {
    serial_number: "BKW8471209384",
    label: "Warehouse B",
    online: true,
    adms_active: true,
    sdk_poll_active: true,
    last_seen_at: NOW() - 60,
    record_count: 28100,
  },
  {
    serial_number: "OFM9928475623",
    label: "Office Floor",
    online: false,
    adms_active: false,
    sdk_poll_active: false,
    last_seen_at: NOW() - 3600,
    record_count: 12200,
  },
];

export const MOCK_HOURLY_BREAKDOWN: DashboardHourlyBreakdown[] = [
  { hour: 5, count: 1 },
  { hour: 6, count: 8 },
  { hour: 7, count: 22 },
  { hour: 8, count: 15 },
  { hour: 9, count: 4 },
  { hour: 10, count: 2 },
];

export const MOCK_TODAY_SUMMARY: TodaySummary = {
  date: NOW(),
  present: 42,
  absent: 8,
  late: 3,
  on_time: 39,
  total_employees: 50,
  total_punches: 84,
  check_ins: 42,
  check_outs: 42,
  last_punch_at: NOW() - MINUTE,
  currently_checked_in: MOCK_CHECKED_IN_EMPLOYEES,
  recent_events: MOCK_RECENT_EVENTS,
  device_health: MOCK_DEVICE_HEALTH,
  hourly_breakdown: MOCK_HOURLY_BREAKDOWN,
};

/** Empty dashboard — no employees, no devices, no punches. */
export const MOCK_TODAY_SUMMARY_EMPTY: TodaySummary = {
  date: NOW(),
  present: 0,
  absent: 0,
  late: 0,
  on_time: 0,
  total_employees: 0,
  total_punches: 0,
  check_ins: 0,
  check_outs: 0,
  last_punch_at: null,
  currently_checked_in: [],
  recent_events: [],
  device_health: [],
  hourly_breakdown: [],
};

/** All devices offline edge case. */
export const MOCK_TODAY_SUMMARY_DEVICES_OFFLINE: TodaySummary = {
  ...MOCK_TODAY_SUMMARY,
  device_health: MOCK_DEVICE_HEALTH.map((d) => ({
    ...d,
    online: false,
    adms_active: false,
    sdk_poll_active: false,
  })),
};

/** No employees checked in right now. */
export const MOCK_TODAY_SUMMARY_NO_CHECKED_IN: TodaySummary = {
  ...MOCK_TODAY_SUMMARY,
  currently_checked_in: [],
};

// ── Punch mocks ───────────────────────────────────────────────────────────────

export const MOCK_PUNCHES: Punch[] = [
  {
    id: "a1b2c3d4-20260711-143122-CQZ7232960836-145-0-15-0",
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW() - 1 * MINUTE,
    status: "check_in",
    verify_mode: "face",
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    is_anomaly: false,
    anomaly_type: null,
  },
  {
    id: "e5f6g7h8-20260711-141500-BKW8471209384-147-1-15-0",
    user_pin: "147",
    employee_name: "Omar Khalid",
    timestamp: NOW() - 17 * MINUTE,
    status: "check_out",
    verify_mode: "card",
    device_sn: "BKW8471209384",
    device_label: "Warehouse B",
    is_anomaly: true,
    anomaly_type: "orphaned_check_out",
  },
  {
    id: "i9j0k1l2-20260711-090200-CQZ7232960836-147-0-15-0",
    user_pin: "147",
    employee_name: "Omar Khalid",
    timestamp: NOW() - 5 * HOUR - 30 * MINUTE,
    status: "check_in",
    verify_mode: "fingerprint",
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    is_anomaly: true,
    anomaly_type: "duplicate_check_in",
  },
  {
    id: "m3n4o5p6-20260711-084530-CQZ7232960836-147-0-15-0",
    user_pin: "147",
    employee_name: "Omar Khalid",
    timestamp: NOW() - 5 * HOUR - 47 * MINUTE,
    status: "check_in",
    verify_mode: "fingerprint",
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    is_anomaly: false,
    anomaly_type: null,
  },
  {
    id: "q7r8s9t0-20260711-075500-CQZ7232960836-146-0-15-0",
    user_pin: "146",
    employee_name: "Fatima Hassan",
    timestamp: NOW() - 6 * HOUR - 37 * MINUTE,
    status: "check_in",
    verify_mode: "fingerprint",
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    is_anomaly: false,
    anomaly_type: null,
  },
  {
    id: "u1v2w3x4-20260711-074215-CQZ7232960836-145-0-15-0",
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW() - 6 * HOUR - 50 * MINUTE,
    status: "check_in",
    verify_mode: "face",
    device_sn: "CQZ7232960836",
    device_label: "Main Gate",
    is_anomaly: false,
    anomaly_type: null,
  },
];

export const MOCK_PUNCHES_ONLY_ANOMALIES: Punch[] = MOCK_PUNCHES.filter((p) => p.is_anomaly);

export const MOCK_PUNCHES_EMPTY: Punch[] = [];

// ── Employee mocks ────────────────────────────────────────────────────────────

/** Hours to seconds helper. */
function hoursToSeconds(h: number): number {
  return Math.round(h * 3600);
}

export const MOCK_EMPLOYEE_KPIS: EmployeeReportKpi[] = [
  {
    user_pin: "146",
    employee_name: "Fatima Hassan",
    days_present: 22,
    days_absent: 0,
    days_late: 0,
    avg_seconds_per_day: hoursToSeconds(8.1),
    overtime_seconds: 0,
    anomaly_count: 0,
  },
  {
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    days_present: 21,
    days_absent: 1,
    days_late: 2,
    avg_seconds_per_day: hoursToSeconds(8.3),
    overtime_seconds: hoursToSeconds(2.5),
    anomaly_count: 0,
  },
  {
    user_pin: "148",
    employee_name: "Layla Noor",
    days_present: 20,
    days_absent: 2,
    days_late: 1,
    avg_seconds_per_day: hoursToSeconds(8.5),
    overtime_seconds: hoursToSeconds(4.0),
    anomaly_count: 0,
  },
  {
    user_pin: "147",
    employee_name: "Omar Khalid",
    days_present: 18,
    days_absent: 4,
    days_late: 5,
    avg_seconds_per_day: hoursToSeconds(7.8),
    overtime_seconds: hoursToSeconds(1.0),
    anomaly_count: 2,
  },
  {
    user_pin: "149",
    employee_name: "Bilal Mahmoud",
    days_present: 22,
    days_absent: 0,
    days_late: 0,
    avg_seconds_per_day: hoursToSeconds(8.0),
    overtime_seconds: 0,
    anomaly_count: 0,
  },
];

// ── Report mocks ──────────────────────────────────────────────────────────────

/** Helper to create a unix timestamp for a July 2026 date at midnight UTC. */
function julyDate(day: number): number {
  return Math.floor(new Date(`2026-07-${String(day).padStart(2, "0")}T00:00:00Z`).getTime() / 1000);
}

export const MOCK_REPORT_SUMMARY: ReportSummary = {
  date_from: julyDate(1),
  date_to: julyDate(12),
  total_punches: 550,
  check_ins: 220,
  check_outs: 210,
  break_outs: 55,
  break_ins: 50,
  overtime_ins: 8,
  overtime_outs: 7,
  unique_users: 50,
  daily_breakdown: [
    { date: julyDate(1), count: 48 },
    { date: julyDate(2), count: 50 },
    { date: julyDate(3), count: 46 },
    { date: julyDate(4), count: 48 },
    { date: julyDate(5), count: 52 },
    { date: julyDate(8), count: 44 },
    { date: julyDate(9), count: 46 },
    { date: julyDate(10), count: 50 },
    { date: julyDate(11), count: 48 },
    { date: julyDate(12), count: 42 },
  ],
  work_days: 22,
  avg_seconds_per_day: hoursToSeconds(8.2),
  overtime_seconds: hoursToSeconds(12.5),
  absence_rate: 4.2,
  daily_hours: [
    {
      date: julyDate(1),
      regular_seconds: hoursToSeconds(8.0),
      overtime_seconds: hoursToSeconds(0.5),
    },
    { date: julyDate(2), regular_seconds: hoursToSeconds(8.0), overtime_seconds: 0 },
    {
      date: julyDate(3),
      regular_seconds: hoursToSeconds(7.5),
      overtime_seconds: hoursToSeconds(1.0),
    },
    {
      date: julyDate(4),
      regular_seconds: hoursToSeconds(8.0),
      overtime_seconds: hoursToSeconds(0.5),
    },
    { date: julyDate(5), regular_seconds: hoursToSeconds(8.0), overtime_seconds: 0 },
    {
      date: julyDate(8),
      regular_seconds: hoursToSeconds(7.5),
      overtime_seconds: hoursToSeconds(0.8),
    },
    {
      date: julyDate(9),
      regular_seconds: hoursToSeconds(8.0),
      overtime_seconds: hoursToSeconds(0.2),
    },
    { date: julyDate(10), regular_seconds: hoursToSeconds(8.0), overtime_seconds: 0 },
    { date: julyDate(11), regular_seconds: hoursToSeconds(8.0), overtime_seconds: 0 },
    {
      date: julyDate(12),
      regular_seconds: hoursToSeconds(7.8),
      overtime_seconds: hoursToSeconds(0.5),
    },
  ],
  weekly_hours: [
    { week: 27, year: 2026, total_seconds: 280 * 3600 },
    { week: 28, year: 2026, total_seconds: 295 * 3600 },
    { week: 29, year: 2026, total_seconds: 310 * 3600 },
  ],
  status_distribution: [
    { status: "full", count: 195, percentage: 78 },
    { status: "half", count: 30, percentage: 12 },
    { status: "absent", count: 25, percentage: 10 },
  ],
  employees: MOCK_EMPLOYEE_KPIS,
};

// ── Auth / Profile mocks ──────────────────────────────────────────────────────

export const MOCK_USER_PROFILE: UserProfile = {
  username: "admin",
  role: "admin",
  permissions: "read:punches write:punches read:devices write:devices manage:users manage:commands",
};

export const MOCK_LOGIN_RESPONSE: LoginResponse = {
  token: "msw-mock-jwt-token",
  expires_in: 86400,
  token_type: "Bearer",
  username: "admin",
  role: "admin",
  permissions: "read:punches write:punches read:devices write:devices manage:users manage:commands",
};

// ── Device mocks ──────────────────────────────────────────────────────────────

export const MOCK_DEVICES: DeviceConfig[] = [
  {
    serial_number: "CQZ7232960836",
    label: "Main Gate",
    host: "192.168.1.100",
    port: DEFAULT_ZKTECO_PORT,
    comm_key: 0,
    push_enabled: true,
    timezone: "Asia/Riyadh",
  },
  {
    serial_number: "BKW8471209384",
    label: "Warehouse B",
    host: "192.168.1.101",
    port: DEFAULT_ZKTECO_PORT,
    comm_key: 0,
    push_enabled: true,
    timezone: "Asia/Riyadh",
  },
  {
    serial_number: "OFM9928475623",
    label: "Office Floor",
    host: "192.168.1.102",
    port: DEFAULT_ZKTECO_PORT,
    comm_key: 0,
    push_enabled: false,
    timezone: "Asia/Riyadh",
  },
];

export const MOCK_DEVICE_SUMMARIES: DeviceSummary[] = MOCK_DEVICES.map((d) => ({
  serial_number: d.serial_number,
  label: d.label,
  host: d.host,
  port: d.port,
  push_enabled: d.push_enabled,
  connection_status: d.serial_number === "OFM9928475623" ? "offline" : "online",
  adms_active: d.serial_number !== "OFM9928475623",
  sdk_poll_active: d.serial_number !== "OFM9928475623",
  last_seen_at: d.serial_number === "OFM9928475623" ? NOW() - 3600 : NOW() - 30,
}));

// ── Envelope helpers ──────────────────────────────────────────────────────────

export function envelope<T>(
  data: T,
  meta?: { has_more: boolean; next_cursor?: string | null; total?: number | null } | null,
): ApiEnvelope<T> {
  return { data, meta: meta ?? null, error: null };
}

/**
 * Quick-access: todaySummary with full data (for Primary story).
 * Use `envelope(todaySummary)` to get the full ApiEnvelope.
 */
export const todaySummary = MOCK_TODAY_SUMMARY;
export const todaySummaryEmpty = MOCK_TODAY_SUMMARY_EMPTY;
export const todaySummaryDevicesOffline = MOCK_TODAY_SUMMARY_DEVICES_OFFLINE;
export const todaySummaryNoCheckedIn = MOCK_TODAY_SUMMARY_NO_CHECKED_IN;
export const checkedInEmployees = MOCK_CHECKED_IN_EMPLOYEES;
export const recentEvents = MOCK_RECENT_EVENTS;
export const deviceHealth = MOCK_DEVICE_HEALTH;
export const hourlyBreakdown = MOCK_HOURLY_BREAKDOWN;
export const punches = MOCK_PUNCHES;
export const punchesAnomalies = MOCK_PUNCHES_ONLY_ANOMALIES;
export const punchesEmpty = MOCK_PUNCHES_EMPTY;
export const employeeKpis = MOCK_EMPLOYEE_KPIS;
export const reportSummary = MOCK_REPORT_SUMMARY;
export const devices = MOCK_DEVICES;
export const deviceSummaries = MOCK_DEVICE_SUMMARIES;
