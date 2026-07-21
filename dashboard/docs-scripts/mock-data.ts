/**
 * Mock API response data for documentation screenshots.
 *
 * Every response is deterministic — same data every run produces
 * identical screenshots. The data is rich enough to look realistic
 * but fabricated (no real employee PII).
 *
 * Shared between:
 *   - docs-scripts/capture-flows.ts  (screenshot generation)
 *   - e2e/flows/*.spec.ts            (E2E tests — same mock shapes)
 *
 * TODO(ENTERPRISE): Replace mock data with seeded backend when
 *   `cargo run --bin seed --features seed` is available.
 *   Phase: E2E hardening
 *   Impact: Screenshots reflect actual DB state; E2E tests exercise
 *           real API → storage → response pipeline.
 *   Fix: Run seed binary before capture script, then use real API
 *         with page.route() only for annotation CSS injection.
 */

import type { Page, Route } from "playwright";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface LoginResponse {
  token: string;
  expires_in: number;
  token_type: "Bearer";
  username: string;
  role: "admin" | "operator" | "viewer";
  permissions: string[];
}

export interface DashboardToday {
  date: string;
  present: number;
  total_punches: number;
  check_ins: number;
  check_outs: number;
  absent: number;
  late: number;
  total_employees: number;
  last_punch_at: number;
}

export interface Device {
  serial_number: string;
  label: string;
  model: string;
  firmware_version: string;
  host: string;
  port: number;
  status: "online" | "offline" | "error" | "syncing";
  last_seen: number | null;
  user_count: number;
  user_capacity: number;
  record_count: number;
  record_capacity: number;
  push_enabled: boolean;
  group_id: string | null;
}

export interface Employee {
  id: string;
  pin: string;
  name: string;
  department: string | null;
  external_id: string | null;
  active: boolean;
  attendance_pct: number;
  created_at: string;
  updated_at: string;
}

export interface Punch {
  id: string;
  device_sn: string;
  user_pin: string;
  employee_name: string;
  timestamp: string;
  status: number;
  status_label: string;
  verify_mode: number;
  verify_label: string;
}

export interface Department {
  id: string;
  name: string;
  employee_count: number;
  has_custom_policy: boolean;
  work_policy: WorkPolicy | null;
}

export interface WorkPolicy {
  start_time: string;
  end_time: string;
  late_threshold_minutes: number;
  overtime_threshold_minutes: number;
  working_days: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// Deterministic mock data
// ═══════════════════════════════════════════════════════════════════════

const NOW = Math.floor(Date.now() / 1000);
const TODAY = new Date().toISOString().slice(0, 10);

export const MOCK_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9._docs_";

export const MOCK_LOGIN: Record<string, LoginResponse> = {
  admin: {
    token: MOCK_JWT,
    expires_in: 86400,
    token_type: "Bearer",
    username: "admin",
    role: "admin",
    permissions: ["*"],
  },
  operator: {
    token: MOCK_JWT,
    expires_in: 86400,
    token_type: "Bearer",
    username: "hr_manager",
    role: "operator",
    permissions: [
      "read_punches",
      "write_punches",
      "read_employees",
      "write_employees",
      "read_reports",
    ],
  },
  viewer: {
    token: MOCK_JWT,
    expires_in: 86400,
    token_type: "Bearer",
    username: "supervisor_eng",
    role: "viewer",
    permissions: ["read_punches", "read_employees", "read_reports"],
  },
};

export const MOCK_DASHBOARD_TODAY: DashboardToday = {
  date: TODAY,
  present: 42,
  total_punches: 84,
  check_ins: 42,
  check_outs: 42,
  absent: 5,
  late: 3,
  total_employees: 50,
  last_punch_at: NOW - 60,
};

export const MOCK_DEVICES: Device[] = [
  {
    serial_number: "CQZ7232960836",
    label: "Office Entrance",
    model: "SpeedFace-V5L",
    firmware_version: "Ver 4.6.2",
    host: "192.168.1.100",
    port: 4370,
    status: "online",
    last_seen: NOW - 5,
    user_count: 245,
    user_capacity: 3000,
    record_count: 18420,
    record_capacity: 100000,
    push_enabled: true,
    group_id: null,
  },
  {
    serial_number: "CQZ7232960807",
    label: "Warehouse East",
    model: "SpeedFace-V5L",
    firmware_version: "Ver 4.6.1",
    host: "192.168.1.101",
    port: 4370,
    status: "online",
    last_seen: NOW - 12,
    user_count: 180,
    user_capacity: 3000,
    record_count: 12500,
    record_capacity: 100000,
    push_enabled: true,
    group_id: null,
  },
  {
    serial_number: "CQZ5958300124",
    label: "Production Floor",
    model: "uFace800",
    firmware_version: "Ver 3.8.0",
    host: "192.168.1.102",
    port: 4370,
    status: "offline",
    last_seen: NOW - 3600,
    user_count: 320,
    user_capacity: 5000,
    record_count: 45300,
    record_capacity: 150000,
    push_enabled: false,
    group_id: null,
  },
  {
    serial_number: "CQZ5958300189",
    label: "Admin Office",
    model: "iFace303",
    firmware_version: "Ver 2.4.5",
    host: "192.168.1.103",
    port: 4370,
    status: "error",
    last_seen: NOW - 1800,
    user_count: 45,
    user_capacity: 1500,
    record_count: 8200,
    record_capacity: 80000,
    push_enabled: true,
    group_id: null,
  },
];

export const MOCK_EMPLOYEES: Employee[] = [
  { id: "emp-001", pin: "1001", name: "Ahmed Al-Sabah", department: "Engineering", external_id: "EXT-001", active: true, attendance_pct: 97.5, created_at: "2025-01-15T08:00:00Z", updated_at: TODAY },
  { id: "emp-002", pin: "1002", name: "Fatima Al-Hashimi", department: "Human Resources", external_id: "EXT-002", active: true, attendance_pct: 94.2, created_at: "2025-01-15T08:00:00Z", updated_at: TODAY },
  { id: "emp-003", pin: "1003", name: "Omar Al-Qahtani", department: "Engineering", external_id: "EXT-003", active: true, attendance_pct: 88.7, created_at: "2025-02-01T08:00:00Z", updated_at: TODAY },
  { id: "emp-004", pin: "1004", name: "Layla Al-Mansoori", department: "Finance", external_id: null, active: true, attendance_pct: 99.1, created_at: "2025-02-15T08:00:00Z", updated_at: TODAY },
  { id: "emp-005", pin: "1005", name: "Khalid Al-Farsi", department: "Operations", external_id: "EXT-005", active: false, attendance_pct: 72.3, created_at: "2025-03-01T08:00:00Z", updated_at: TODAY },
  { id: "emp-006", pin: "1006", name: "Noor Al-Shammari", department: "Human Resources", external_id: "EXT-006", active: true, attendance_pct: 91.8, created_at: "2025-03-15T08:00:00Z", updated_at: TODAY },
  { id: "emp-007", pin: "1007", name: "Youssef Al-Ghamdi", department: "Engineering", external_id: null, active: true, attendance_pct: 95.0, created_at: "2025-04-01T08:00:00Z", updated_at: TODAY },
];

export const MOCK_PUNCHES: Punch[] = [
  { id: "punch-001", device_sn: "CQZ7232960836", user_pin: "1001", employee_name: "Ahmed Al-Sabah", timestamp: `${TODAY}T07:55:22Z`, status: 0, status_label: "Check In", verify_mode: 1, verify_label: "Fingerprint" },
  { id: "punch-002", device_sn: "CQZ7232960836", user_pin: "1002", employee_name: "Fatima Al-Hashimi", timestamp: `${TODAY}T08:02:15Z`, status: 0, status_label: "Check In", verify_mode: 1, verify_label: "Fingerprint" },
  { id: "punch-003", device_sn: "CQZ7232960807", user_pin: "1003", employee_name: "Omar Al-Qahtani", timestamp: `${TODAY}T08:14:30Z`, status: 0, status_label: "Check In", verify_mode: 3, verify_label: "Face" },
  { id: "punch-004", device_sn: "CQZ7232960836", user_pin: "1001", employee_name: "Ahmed Al-Sabah", timestamp: `${TODAY}T12:00:05Z`, status: 2, status_label: "Break Out", verify_mode: 1, verify_label: "Fingerprint" },
  { id: "punch-005", device_sn: "CQZ7232960836", user_pin: "1001", employee_name: "Ahmed Al-Sabah", timestamp: `${TODAY}T12:30:10Z`, status: 3, status_label: "Break In", verify_mode: 1, verify_label: "Fingerprint" },
  { id: "punch-006", device_sn: "CQZ7232960807", user_pin: "1007", employee_name: "Youssef Al-Ghamdi", timestamp: `${TODAY}T16:55:42Z`, status: 1, status_label: "Check Out", verify_mode: 15, verify_label: "Palm" },
];

export const MOCK_DEPARTMENTS: Department[] = [
  { id: "dept-001", name: "Engineering", employee_count: 18, has_custom_policy: false, work_policy: null },
  { id: "dept-002", name: "Human Resources", employee_count: 5, has_custom_policy: false, work_policy: null },
  { id: "dept-003", name: "Finance", employee_count: 7, has_custom_policy: false, work_policy: null },
  { id: "dept-004", name: "Operations", employee_count: 12, has_custom_policy: true, work_policy: { start_time: "06:00", end_time: "14:00", late_threshold_minutes: 10, overtime_threshold_minutes: 30, working_days: ["sunday", "monday", "tuesday", "wednesday", "thursday"] } },
];

export const MOCK_USER_LIST = [
  { id: "user-001", username: "admin", role: "admin", display_name: "Dev Admin", active: true },
  { id: "user-002", username: "hr_manager", role: "operator", display_name: "HR Manager", active: true },
  { id: "user-003", username: "supervisor_eng", role: "viewer", display_name: "Engineering Supervisor", active: true },
];

// ═══════════════════════════════════════════════════════════════════════
// Route handler
// ═══════════════════════════════════════════════════════════════════════

type Role = "admin" | "operator" | "viewer";

/**
 * Matches only actual backend API calls (pathname starts with /api/).
 *
 * CRITICAL: We CANNOT use Playwright glob patterns like `**\/api\/**`
 * because the `**` prefix greedily matches paths like
 * `src/lib/api/index.ts` (Vite-served source files). Intercepting those
 * breaks the entire app with "Expected JavaScript module but got JSON".
 *
 * This predicate only matches requests where /api/ is the first path
 * segment — i.e. actual backend API calls proxied by the Vite dev server.
 */
function isApiCall(url: URL): boolean {
  return url.pathname.startsWith("/api/");
}

/**
 * Registers all API mocks on a Playwright page.
 *
 * Uses a SINGLE `page.route(isApiCall, ...)` with pathname dispatching.
 * Multiple `page.route()` calls with glob patterns were causing the
 * catch-all `**\/api\/**` to intercept Vite-served source modules
 * (e.g. src/lib/api/index.ts), which returned JSON instead of JavaScript
 * and broke the entire React app.
 */
export async function mockAllRoutes(page: Page, role: Role): Promise<void> {
  await page.route(isApiCall, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    // ── Auth ──────────────────────────────────────────────────────

    if (path === "/api/auth/login" && method === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      const valid =
        body.username === role ||
        (role === "admin" && body.username === "admin");
      if (valid) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_LOGIN[role]) });
      }
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Invalid credentials" }) });
    }

    if (path === "/api/me" || path === "/api/auth/me") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_LOGIN[role]) });
    }

    if (path === "/api/client-config") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ setup_needed: false, workspace_name: "Alsabah Group", version: "0.1.0", features: {} }) });
    }

    // ── Dashboard ─────────────────────────────────────────────────

    if (path === "/api/dashboard/today") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_DASHBOARD_TODAY) });
    }

    // ── Devices ───────────────────────────────────────────────────

    if (path === "/api/devices") {
      const search = url.searchParams.get("search") ?? "";
      let devices = MOCK_DEVICES;
      if (search) {
        const q = search.toLowerCase();
        devices = devices.filter((d) => d.label.toLowerCase().includes(q) || d.serial_number.toLowerCase().includes(q));
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ devices, count: devices.length }) });
    }

    const deviceDetailMatch = path.match(/^\/api\/devices\/([^/]+)$/);
    if (deviceDetailMatch) {
      const device = MOCK_DEVICES.find((d) => d.serial_number === deviceDetailMatch[1]);
      if (!device) return route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(device) });
    }

    // ── Employees ─────────────────────────────────────────────────

    if (path === "/api/employees") {
      const search = url.searchParams.get("search") ?? "";
      let employees = MOCK_EMPLOYEES;
      if (search) {
        const q = search.toLowerCase();
        employees = employees.filter((e) => e.name.toLowerCase().includes(q));
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ employees, count: employees.length }) });
    }

    const empDetailMatch = path.match(/^\/api\/employees\/(.+)$/);
    if (empDetailMatch) {
      const employee = MOCK_EMPLOYEES.find((e) => e.id === empDetailMatch[1]);
      if (!employee) return route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(employee) });
    }

    // ── Punches ───────────────────────────────────────────────────

    if (path === "/api/punches/cursor") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ punches: MOCK_PUNCHES, next_cursor: null, count: MOCK_PUNCHES.length }) });
    }

    // ── Departments ───────────────────────────────────────────────

    if (path === "/api/departments") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ departments: MOCK_DEPARTMENTS, count: MOCK_DEPARTMENTS.length }) });
    }

    // ── Users ─────────────────────────────────────────────────────

    if (path === "/api/users") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ users: MOCK_USER_LIST, count: MOCK_USER_LIST.length }) });
    }

    // ── Settings ──────────────────────────────────────────────────

    if (path === "/api/settings") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ poll_interval_secs: 60, auto_discover: false, work_policy: { start_time: "08:00", end_time: "17:00", late_threshold_minutes: 15, overtime_threshold_minutes: 60, working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"] } }) });
    }

    // ── Reports ───────────────────────────────────────────────────

    if (path === "/api/reports/summary") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ period: { start: `${TODAY}T00:00:00Z`, end: `${TODAY}T23:59:59Z` }, work_days: 22, avg_hours: 8.2, overtime_hours: 12.5, absence_rate: 4.8, daily_hours: [] }) });
    }

    // ── Audit log ─────────────────────────────────────────────────

    if (path === "/api/audit") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ logs: [{ id: "audit-001", timestamp: NOW - 300, actor: "admin", action: "device.registered", resource: "CQZ7232960836", status: "success" }, { id: "audit-002", timestamp: NOW - 600, actor: "hr_manager", action: "punch.corrected", resource: "punch-003", status: "success" }], count: 2 }) });
    }

    // ── Catch-all for unmapped API routes ─────────────────────────

    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
}
