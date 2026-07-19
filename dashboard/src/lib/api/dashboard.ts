import { apiGet, apiGetWithMeta } from "./client";

// ── Today Summary ──────────────────────────────────────────────────────────

/** Matches the Rust `TodaySummaryResponse` DTO. */
export type TodaySummary = {
  date: number;
  present: number;
  absent: number;
  late: number;
  on_time: number;
  total_employees: number;
  total_punches: number;
  check_ins: number;
  check_outs: number;
  last_punch_at: number | null;
  /** Employees who checked in today but have not yet checked out. */
  currently_checked_in?: CurrentlyCheckedIn[];
  /** Last 20 punches for the activity feed. */
  recent_events?: DashboardRecentEvent[];
  /** Per-device connection health. */
  device_health?: DashboardDeviceHealth[];
  /** Punch counts grouped by hour (0-23). */
  hourly_breakdown?: DashboardHourlyBreakdown[];
};

/** An employee currently on-site (checked in, not yet checked out). */
export type CurrentlyCheckedIn = {
  user_pin: string;
  employee_name?: string | null;
  check_in_time: number;
  device_sn: string;
  device_label?: string | null;
  elapsed_seconds: number;
};

/** A recent attendance event for the dashboard activity feed. */
export type DashboardRecentEvent = {
  user_pin: string;
  employee_name?: string | null;
  timestamp: number;
  status: string;
  device_sn: string;
};

/** Per-device health information. */
export type DashboardDeviceHealth = {
  serial_number: string;
  label: string;
  online: boolean;
  adms_active: boolean;
  sdk_poll_active: boolean;
  last_seen_at?: number | null;
  record_count: number;
};

/** Hourly punch distribution. */
export type DashboardHourlyBreakdown = {
  hour: number;
  count: number;
};

export function fetchTodaySummary(): Promise<TodaySummary> {
  return apiGet<TodaySummary>("dashboard/today").json();
}

// ── Quick Stats ────────────────────────────────────────────────────────────

/** Matches the Rust `QuickStatsResponse` DTO. */
export type QuickStats = {
  unique_users: number;
  total_punches: number;
  check_ins: number;
  check_outs: number;
  currently_present: number;
  late_arrivals: number;
  anomalies_detected: number;
  work_days: import("@/lib/api").WorkDay[];
};

/** Fetch dashboard quick stats. Requires Viewer+. */
export function fetchQuickStats(): Promise<QuickStats> {
  return apiGet<QuickStats>("dashboard/quick-stats").json();
}

// ── Devices Health ─────────────────────────────────────────────────────────

/** Matches the Rust `DeviceHealthEntry` DTO. */
export type DeviceHealthEntry = {
  serial_number: string;
  label: string;
  status: string;
  record_usage_pct: number;
  last_seen_at?: number | null;
};

/** Matches the Rust `DeviceHealthSummaryResponse` DTO. */
export type DeviceHealthSummary = {
  total: number;
  online: number;
  offline: number;
  syncing: number;
  errors: number;
  devices: DeviceHealthEntry[];
};

/** Fetch health summary for all devices. Requires Viewer+. */
export function fetchDevicesHealth(): Promise<DeviceHealthSummary> {
  return apiGet<DeviceHealthSummary>("devices/health").json();
}

// ── Device Activity ────────────────────────────────────────────────────────

/** Matches the Rust `DeviceActivityEntry` DTO. */
export type DeviceActivityEvent = {
  id: string;
  /** ISO-8601 timestamp string. */
  timestamp: string;
  label: string;
  event_type: string;
  actor: string;
  source: string;
  is_problem: boolean;
};

/** Paginated activity response. */
export type DeviceActivityPage = {
  events: DeviceActivityEvent[];
  has_more: boolean;
  next_cursor?: string | null;
};

/** Fetch paginated activity feed for a device. */
export function fetchDeviceActivity(
  deviceSn: string,
  limit?: number,
): Promise<DeviceActivityPage> {
  const params = limit ? `?limit=${encodeURIComponent(String(limit))}` : "";
  return apiGetWithMeta<{ events: DeviceActivityEvent[] }>(
    `devices/${encodeURIComponent(deviceSn)}/activity${params}`,
  )
    .json()
    .then(({ data, meta }) => ({
      events: data.events,
      has_more: meta?.has_more ?? false,
      next_cursor: meta?.next_cursor ?? null,
    }));
}
