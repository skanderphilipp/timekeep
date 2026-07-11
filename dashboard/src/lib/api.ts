import {
  AUTH_LOGOUT_EVENT,
  setAuthToken,
  apiGet,
  apiGetWithMeta,
  apiPost,
  apiPut,
  apiDelete,
} from "./api-client";
import type { PunchStatusValue } from "@shared/punch-statuses";
import type { VerifyModeValue } from "@shared/verify-modes";
import type { DeviceStatusValue } from "@shared/device-statuses";
import type { DeviceVendorValue } from "@shared/device-vendors";
import { INTEGRATION_KINDS, type IntegrationKindValue } from "@shared/integration-kinds";
import type { DeviceCommandValue } from "@shared/device-commands";
import type { Role } from "@shared/roles";

// ── Re-exports ────────────────────────────────────────────────────────────────

export { AUTH_LOGOUT_EVENT, setAuthToken };

// ── Types ────────────────────────────────────────────────────────────────────

/** Matches the Rust `DeviceSummary` DTO (list endpoint). */
export type DeviceSummary = {
  serial_number: string;
  label: string;
  host: string;
  port: number;
  push_enabled: boolean;
  /** Canonical connection state from the backend. */
  connection_status: DeviceStatusValue;
  /** Whether ADMS push (real-time events) is active */
  adms_active: boolean;
  /** Whether the SDK poll loop is running for this device */
  sdk_poll_active: boolean;
  /** Last time the device was seen (Unix timestamp in seconds) */
  last_seen_at?: number | null;
};

/** Full device config (create/update/get detail endpoint). */
export type DeviceConfig = {
  serial_number: string;
  label: string;
  host: string;
  port: number;
  comm_key: number;
  push_enabled: boolean;
  timezone: string | null;
  /** Device vendor key. Defaults to "zkteco" when not specified. */
  vendor?: DeviceVendorValue | null;
};

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

/** Matches the Rust `PunchResponse` DTO. */
export type Punch = {
  id: string;
  user_pin: string;
  timestamp: number;
  status: PunchStatusValue;
  verify_mode: VerifyModeValue;
  device_sn: string;
  /** Human-readable device label (from configured devices). */
  device_label?: string | null;
  work_code?: string | null;
  employee_name?: string | null;
  /** Whether the attendance calculator flagged this punch as anomalous. */
  is_anomaly?: boolean;
  /** The anomaly type if flagged (e.g., "duplicate_check_in", "orphaned_check_out"). */
  anomaly_type?: string | null;
};

export type PunchFilter = {
  device_sn?: string;
  /** Multi-select device filter (OR logic). */
  device_sns?: string[];
  user_pin?: string;
  since?: string;
  until?: string;
  /** Filter by punch status: check_in, check_out, break_out, break_in, overtime_in, overtime_out. */
  status?: string;
  /** Filter by verification method: fingerprint, face, card, password, palm. */
  verify_mode?: string;
  /** When "true", return only punches flagged as anomalous by the attendance calculator. */
  anomalies_only?: string;
  /** Sort column (e.g. "timestamp", "user_pin", "device_sn"). */
  sort_by?: string;
  /** Sort direction: true = descending, false = ascending. */
  order_desc?: boolean;
  limit?: number;
  offset?: number;
  cursor?: string;
};

/** Matches the Rust `PunchListResponse` wrapped in `ApiEnvelope`. */
export type PaginatedResponse<T> = {
  punches: T[];
};

/** Cursor-aware paginated response for infinite scroll. */
export type CursorPaginatedResponse<T> = {
  punches: T[];
  has_more: boolean;
  next_cursor?: string | null;
};

// ── Facet filter types (matches Rust FacetGroup / FacetOption) ───────────

/** How a facet dimension behaves in the UI. */
export type FacetKind = "enum" | "reference";

/** A single selectable value in a facet dimension. */
export type FacetOption = {
  value: string;
  label: string;
  count?: number | null;
};

/** One facet dimension with its available values. */
export type FacetGroup = {
  key: string;
  label: string;
  kind: FacetKind;
  options: FacetOption[];
  has_more: boolean;
  total?: number | null;
};

// ── Auth API ─────────────────────────────────────────────────────────────────

export type LoginRequest = {
  username: string;
  password: string;
};

/** Enriched login response — includes user profile from the backend. */
export type LoginResponse = {
  token: string;
  expires_in: number;
  token_type: string;
  username: string;
  role: Role;
  permissions: string;
};

/** User profile returned from GET /api/auth/me. */
export type UserProfile = {
  username: string;
  role: Role;
  permissions: string;
};

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiPost<LoginResponse>("auth/login", credentials).json();
}

// ── Setup (First-Run Onboarding) ──────────────────────────────────────────

/** Check if the system needs initial setup. */
export type SetupStatus = { setup_needed: boolean };

export function fetchSetupStatus(): Promise<SetupStatus> {
  return apiGet<SetupStatus>("status").json();
}

export type SetupRequest = {
  username: string;
  password: string;
  display_name?: string;
};

export type SetupResponse = {
  token: string;
  expires_in: number;
  username: string;
  role: string;
};

export function performSetup(body: SetupRequest): Promise<SetupResponse> {
  return apiPost<SetupResponse>("setup", body).json();
}

/** Fetch the current user's profile from the server. */
export function fetchMe(): Promise<UserProfile> {
  return apiGet<UserProfile>("auth/me").json();
}

/**
 * Convert a space-separated permissions string into a `Set<string>`
 * for convenient permission lookups.
 */
export function permissionsToSet(perms: string): Set<string> {
  return new Set(perms.split(/\s+/).filter(Boolean));
}

// ── Device API ───────────────────────────────────────────────────────────────

export function fetchDevices(): Promise<DeviceSummary[]> {
  return apiGet<DeviceSummary[]>("devices").json();
}

export function fetchDevice(sn: string): Promise<DeviceConfig & { status?: string }> {
  return apiGet<DeviceConfig & { status?: string }>(`devices/${encodeURIComponent(sn)}`).json();
}

export function createDevice(config: DeviceConfig): Promise<{ status: string }> {
  return apiPost<{ status: string }>("devices", config).json();
}

export function updateDevice(
  sn: string,
  config: Partial<DeviceConfig>,
): Promise<{ status: string }> {
  return apiPut<{ status: string }>(`devices/${encodeURIComponent(sn)}`, config).json();
}

export function deleteDevice(sn: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`devices/${encodeURIComponent(sn)}`).json();
}

// ── Dashboard API ────────────────────────────────────────────────────────────

export function fetchTodaySummary(): Promise<TodaySummary> {
  return apiGet<TodaySummary>("dashboard/today").json();
}

// ── Punch API ────────────────────────────────────────────────────────────────

/** Convert an ISO 8601 date string to a Unix timestamp (seconds). */
function toUnixSeconds(iso: string): string {
  return String(Math.floor(new Date(iso).getTime() / 1000));
}

function buildPunchParams(filter: PunchFilter): string {
  const params = new URLSearchParams();
  if (filter.device_sn) params.set("device_sn", filter.device_sn);
  if (filter.device_sns) {
    for (const sn of filter.device_sns) {
      params.append("device_sn[]", sn);
    }
  }
  if (filter.user_pin) params.set("user_pin", filter.user_pin);
  if (filter.status) params.set("status", filter.status);
  if (filter.verify_mode) params.set("verify_mode", filter.verify_mode);
  if (filter.anomalies_only) params.set("anomalies_only", "true");
  if (filter.since) params.set("since", toUnixSeconds(filter.since));
  if (filter.until) params.set("until", toUnixSeconds(filter.until));
  if (filter.sort_by) params.set("sort_by", filter.sort_by);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.order_desc !== undefined) params.set("order_desc", String(filter.order_desc));
  if (filter.cursor) params.set("cursor", filter.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchPunches(filter: PunchFilter = {}): Promise<PaginatedResponse<Punch>> {
  return apiGet<PaginatedResponse<Punch>>(`punches${buildPunchParams(filter)}`).json();
}

/**
 * Fetch punches with cursor metadata for infinite scroll.
 *
 * Returns `{ punches, has_more, next_cursor }` so the consumer
 * can pass `next_cursor` as `cursor` in the next request.
 */
export function fetchPunchesCursor(
  filter: PunchFilter = {},
): Promise<CursorPaginatedResponse<Punch>> {
  return apiGetWithMeta<PaginatedResponse<Punch>>(`punches${buildPunchParams(filter)}`)
    .json()
    .then(({ data, meta }) => ({
      punches: data.punches,
      has_more: meta?.has_more ?? false,
      next_cursor: meta?.next_cursor ?? null,
    }));
}

/** Filter params for the facet metadata endpoint. */
export type FacetFilterParams = {
  dimension?: string;
  search?: string;
  limit?: number;
  device_sn?: string;
  device_sns?: string[];
  since?: string;
  until?: string;
  status?: string;
  verify_mode?: string;
  anomalies_only?: string;
};

function buildFacetParams(filter: FacetFilterParams): string {
  const params = new URLSearchParams();
  if (filter.dimension) params.set("dimension", filter.dimension);
  if (filter.search) params.set("search", filter.search);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.device_sn) params.set("device_sn", filter.device_sn);
  if (filter.device_sns) {
    for (const sn of filter.device_sns) {
      params.append("device_sn[]", sn);
    }
  }
  if (filter.since) params.set("since", toUnixSeconds(filter.since));
  if (filter.until) params.set("until", toUnixSeconds(filter.until));
  if (filter.status) params.set("status", filter.status);
  if (filter.verify_mode) params.set("verify_mode", filter.verify_mode);
  if (filter.anomalies_only) params.set("anomalies_only", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Fetch faceted filter metadata for punch queries.
 *
 * Returns available filter values (devices, statuses, employees, etc.)
 * with contextual punch counts that respect the current date range
 * and other active filters.
 */
export function fetchPunchFilters(filter: FacetFilterParams = {}): Promise<FacetGroup[]> {
  return apiGet<FacetGroup[]>(`punches/filters${buildFacetParams(filter)}`).json();
}

// ── Correction ───────────────────────────────────────────────────────────────

export type CorrectPunchRequest = {
  user_pin: string;
  device_sn: string;
  /** One of: check_in, check_out, break_out, break_in */
  status: string;
  /** Unix timestamp in seconds. Defaults to now if omitted. */
  timestamp?: number;
};

/** Matches the Rust `PunchCorrectedResponse` DTO. */
export type PunchCorrectedResponse = {
  id: string;
  user_pin: string;
  timestamp: number;
  status: string;
};

export function correctPunch(correction: CorrectPunchRequest): Promise<PunchCorrectedResponse> {
  return apiPost<PunchCorrectedResponse>("punches/correct", correction).json();
}

// ── Integration Endpoints API ──────────────────────────────────────────────

/** Matches the Rust `IntegrationEndpoint` / `EndpointResponse` DTO. */
export type IntegrationEndpoint = {
  id: string;
  name: string;
  /** Integration kind — matches shared catalog. */
  kind: IntegrationKindValue;
  enabled: boolean;
  /** Type-specific JSON config object. */
  config: Record<string, unknown>;
  created_at: number;
  updated_at: number;
};

/**
 * Lingui translation function signature (accepts MessageDescriptor objects).
 * Shared with `permissions.ts` — keep in sync.
 */
type T = (descriptor: { id: string; message: string }) => string;

// Re-export from shared catalog — single source of truth.
export { INTEGRATION_KINDS };
export type IntegrationKind = IntegrationKindValue;

/**
 * Create translated integration kinds for React components.
 *
 * Use in React components via `useLingui()`:
 *   const { _ } = useLingui();
 *   const kinds = createIntegrationKinds(_);
 *
 * Non-React contexts should import {@link INTEGRATION_KINDS} directly
 * (English defaults).
 */
export function createIntegrationKinds(_: T) {
  return INTEGRATION_KINDS.map((k) => ({
    ...k,
    label: _({ id: k.value, message: k.label }),
  }));
}

/** Matches the Rust `CreateEndpointRequest` DTO. */
export type CreateEndpointRequest = {
  name: string;
  kind: IntegrationKindValue;
  config?: Record<string, unknown>;
};

/** Matches the Rust `UpdateEndpointRequest` DTO. */
export type UpdateEndpointRequest = {
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

/** Fetch all integration endpoints. Requires Viewer+. */
export function fetchEndpoints(): Promise<IntegrationEndpoint[]> {
  return apiGet<IntegrationEndpoint[]>("endpoints").json();
}

/** Create a new integration endpoint. Requires Admin. */
export function createEndpoint(req: CreateEndpointRequest): Promise<IntegrationEndpoint> {
  return apiPost<IntegrationEndpoint>("endpoints", req).json();
}

/** Update an integration endpoint. Requires Admin. */
export function updateEndpoint(
  id: string,
  req: UpdateEndpointRequest,
): Promise<IntegrationEndpoint> {
  return apiPut<IntegrationEndpoint>(`endpoints/${encodeURIComponent(id)}`, req).json();
}

/** Delete an integration endpoint. Requires Admin. */
export function deleteEndpoint(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`endpoints/${encodeURIComponent(id)}`).json();
}

// ── System Settings API ───────────────────────────────────────────────────

/** Matches the Rust `SystemSettings` / `SystemSettingsResponse` DTO. */
export type SystemSettings = {
  poll_interval_secs: number;
  auto_discover: boolean;
};

/** Matches the Rust `UpdateSystemSettingsRequest` DTO. */
export type UpdateSystemSettingsRequest = Partial<SystemSettings>;

/** Fetch system-wide settings. Requires Viewer+. */
export function fetchSystemSettings(): Promise<SystemSettings> {
  return apiGet<SystemSettings>("settings").json();
}

/** Update system-wide settings. Requires Admin. */
export function updateSystemSettings(
  settings: UpdateSystemSettingsRequest,
): Promise<SystemSettings> {
  return apiPut<SystemSettings>("settings", settings).json();
}

// ── Reports API ────────────────────────────────────────────────────────────

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

// ── Export API ──────────────────────────────────────────────────────────────

export type ExportFilter = {
  device_sn?: string;
  user_pin?: string;
  since?: string;
  until?: string;
  limit?: number;
  sort_order?: "asc" | "desc";
  format?: "csv" | "xlsx";
};

function buildExportParams(f: ExportFilter): string {
  const params = new URLSearchParams();
  if (f.device_sn) params.set("device_sn", f.device_sn);
  if (f.user_pin) params.set("user_pin", f.user_pin);
  if (f.since) params.set("since", toUnixSeconds(f.since));
  if (f.until) params.set("until", toUnixSeconds(f.until));
  if (f.limit !== undefined) params.set("limit", String(f.limit));
  if (f.sort_order) params.set("sort_order", f.sort_order);
  if (f.format) params.set("format", f.format);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Download exported punches as a file (CSV or XLSX).
 *
 * Returns a Blob suitable for triggering a browser download.
 * Requires Admin.
 */
export async function fetchPunchExport(filter: ExportFilter = {}): Promise<Blob> {
  const url = `exports/punches${buildExportParams(filter)}`;
  const response = await fetch(`/api/${url}`, {
    headers: buildAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
  return response.blob();
}

/** Shared auth header helper for raw fetch calls (export endpoint returns binary). */
function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const raw = localStorage.getItem("ao-auth");
    if (raw) {
      const token: unknown = JSON.parse(raw);
      if (typeof token === "string" && token.length > 0) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // No token — request goes without auth header
  }
  return headers;
}

// ── Device Users API ──────────────────────────────────────────────────────

/** Matches the Rust `SetUserRequest` DTO. */
export type SetUserRequest = {
  /** Employee PIN (numeric ID on the device). */
  pin: string;
  /** Display name. */
  name: string;
  /** Internal user serial number on the device (default: 0). */
  internal_sn?: number;
  /** User privilege level (0 = normal, 14 = admin). */
  privilege?: number;
  /** RFID card number (if applicable). */
  card_number?: string | null;
  /** Whether the user has a password set. */
  has_password?: boolean;
};

/** Enroll a user on a device via API. Requires Operator+. */
export function setUserOnDevice(
  deviceSn: string,
  user: SetUserRequest,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(`devices/${encodeURIComponent(deviceSn)}/users`, user).json();
}

/** Delete a user from a device. Requires Operator+. */
export function deleteUserFromDevice(
  deviceSn: string,
  userSn: string,
): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(
    `devices/${encodeURIComponent(deviceSn)}/users/${encodeURIComponent(userSn)}`,
  ).json();
}

// ── Device Commands API ────────────────────────────────────────────────────

/** Matches the Rust `EnqueueCommandRequest` DTO. */
export type EnqueueCommandRequest = {
  command: DeviceCommandValue;
};

/** Enqueue a command for a device (via ADMS push). Requires Operator+. */
export function enqueueDeviceCommand(
  deviceSn: string,
  cmd: EnqueueCommandRequest,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `devices/${encodeURIComponent(deviceSn)}/commands`,
    cmd,
  ).json();
}

// ── API Key Management ─────────────────────────────────────────────────────

/** Matches the Rust `ApiKeyResponse` DTO. */
export type ApiKey = {
  id: string;
  name: string;
  /** First 16 characters of the key (for display identification). */
  prefix: string;
  /** Scoped permissions granted to this key. */
  permissions: string[];
  /** Who created this key. */
  created_by: string;
  /** Unix timestamp of creation. */
  created_at: number;
  /** Unix timestamp of last use (null = never used). */
  last_used_at: number | null;
  /** Unix timestamp of expiration (null = never expires). */
  expires_at: number | null;
  /** Whether this key has been revoked. */
  revoked: boolean;
};

/** Matches the Rust `CreateApiKeyRequest` DTO. */
export type CreateApiKeyRequest = {
  /** Human-readable name (e.g. "Odoo Production Integration"). */
  name: string;
  /** Space-separated permissions (e.g. "read:punches write:punches"). */
  permissions: string;
  /** Number of days until expiration. Omit for no expiration. */
  expires_in_days?: number;
};

/** Response returned ONCE when an API key is created — includes the raw key. */
export type ApiKeyCreatedResponse = ApiKey & {
  /** The full API key. Store it securely — it will not be shown again. */
  api_key: string;
};

/** List all API keys (metadata only). Requires Operator+. */
export function fetchApiKeys(): Promise<ApiKey[]> {
  return apiGet<ApiKey[]>("api-keys").json();
}

/** Create a new API key. Returns the raw key ONCE. Requires Admin. */
export function createApiKey(req: CreateApiKeyRequest): Promise<ApiKeyCreatedResponse> {
  return apiPost<ApiKeyCreatedResponse>("api-keys", req).json();
}

/** Revoke an API key (soft delete). Requires Admin. */
export function revokeApiKey(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`api-keys/${encodeURIComponent(id)}`).json();
}

// ── Health API ──────────────────────────────────────────────────────────────

/** Engine pipeline stats from the health endpoint. */
export type EngineHealthStats = {
  events_processed: number;
  events_dropped: number;
  events_distributed: number;
  events_failed: number;
};

/** Per-distributor health entry. */
export type DistributorHealthEntry = {
  name: string;
  delivered: number;
  dead: number;
  queued: number;
};

/** Per-device connection health. */
export type DeviceHealthInfo = {
  serial_number: string;
  adms_active: boolean;
  sdk_active: boolean;
  last_seen_secs_ago?: number | null;
  last_poll_secs_ago?: number | null;
};

/** Matches the Rust `HealthResponse` DTO (rich version). */
export type Health = {
  status: string;
  version: string;
  db: string;
  uptime_seconds: number;
  engine?: EngineHealthStats | null;
  distributors?: DistributorHealthEntry[] | null;
  devices?: DeviceHealthInfo[] | null;
};

/** Health check with real database ping, engine stats, device status, and distributor info. */
export function fetchHealth(): Promise<Health> {
  return apiGet<Health>("health").json();
}

// ── Audit API ────────────────────────────────────────────────────────────────

/** Matches the Rust `AuditEventResponse` DTO. */
export type AuditEvent = {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  detail?: Record<string, unknown> | null;
  ip_address?: string | null;
  status: string;
  error_message?: string | null;
};

export type AuditFilter = {
  actor?: string;
  action?: string;
  resource?: string;
  since?: string;
  until?: string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  limit?: number;
  cursor?: string;
};

function buildAuditParams(filter: AuditFilter): string {
  const params = new URLSearchParams();
  if (filter.actor) params.set("actor", filter.actor);
  if (filter.action) params.set("action", filter.action);
  if (filter.resource) params.set("resource", filter.resource);
  if (filter.since)
    params.set("since", String(Math.floor(new Date(filter.since).getTime() / 1000)));
  if (filter.until)
    params.set("until", String(Math.floor(new Date(filter.until).getTime() / 1000)));
  if (filter.search) params.set("search", filter.search);
  if (filter.sort_by) params.set("sort_by", filter.sort_by);
  if (filter.sort_order) params.set("sort_order", filter.sort_order);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.cursor) params.set("cursor", filter.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Query audit logs. Requires Viewer+. */
export function fetchAuditLogs(filter: AuditFilter = {}): Promise<AuditEvent[]> {
  return apiGet<AuditEvent[]>(`audit${buildAuditParams(filter)}`).json();
}

// ── Users API ─────────────────────────────────────────────────────────────────

/** Matches the Rust `DashboardUserResponse` DTO. */
export type DashboardUser = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  /** Space-separated permission tokens. */
  permissions: string;
  active: boolean;
  created_at: number;
  updated_at: number;
};

/** Matches the Rust `CreateDashboardUserRequest` DTO. */
export type CreateDashboardUserRequest = {
  username: string;
  password: string;
  display_name?: string | null;
  role?: Role;
  permissions?: string[] | null;
};

/** Matches the Rust `UpdateDashboardUserRequest` DTO. */
export type UpdateDashboardUserRequest = {
  display_name?: string | null;
  role?: Role | null;
  permissions?: string[] | null;
  active?: boolean | null;
};

/** List all dashboard users. Requires Admin or Operator. */
export function fetchUsers(): Promise<DashboardUser[]> {
  return apiGet<DashboardUser[]>("users").json();
}

/** Create a new dashboard user. Requires Admin. */
export function createUser(req: CreateDashboardUserRequest): Promise<DashboardUser> {
  return apiPost<DashboardUser>("users", req).json();
}

/** Update a dashboard user's role, name, or active status. Requires Admin. */
export function updateUser(id: string, req: UpdateDashboardUserRequest): Promise<DashboardUser> {
  return apiPut<DashboardUser>(`users/${encodeURIComponent(id)}`, req).json();
}

/** Delete a dashboard user. Requires Admin. */
export function deleteUser(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`users/${encodeURIComponent(id)}`).json();
}

/** Change a user's password. Requires Admin (or self). */
export function changePassword(id: string, password: string): Promise<{ status: string }> {
  return apiPut<{ status: string }>(`users/${encodeURIComponent(id)}/password`, {
    password,
  }).json();
}
