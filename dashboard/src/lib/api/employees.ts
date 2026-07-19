import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { FacetGroup } from "./client";
import type { EntitySchema } from "@/types/metadata";

// ── Employee CRUD ──────────────────────────────────────────────────────────

/** Matches the Rust `Employee` model. */
export type Employee = {
  id: string;
  pin: string;
  name: string;
  /**
   * Department UUID for cross-entity navigation.
   *
   * When set, the frontend can construct a link to the department
   * detail page. Resolved from the department name at query time.
   */
  department_id?: string | null;
  /**
   * Human-readable department name for list display (e.g. "Engineering").
   *
   * Resolved by the backend from `department_id` at query time.
   * This is a display-only denormalization — use `department_id`
   * for navigation and mutations.
   */
  department?: string | null;
  external_id?: string | null;
  active: boolean;
  created_at: number;
  updated_at: number;
};

/** Matches the Rust `CreateEmployeeRequest` DTO. */
export type CreateEmployeeRequest = {
  pin: string;
  name: string;
  /**
   * Department UUID for cross-entity navigation.
   * When provided, the department name is resolved and stored as `department`.
   */
  department_id?: string | null;
  external_id?: string | null;
};

/** Matches the Rust `UpdateEmployeeRequest` DTO. */
export type UpdateEmployeeRequest = {
  name?: string | null;
  /**
   * Department UUID for cross-entity navigation.
   * When provided, the department name is resolved and stored as `department`.
   */
  department_id?: string | null;
  external_id?: string | null;
  /** Whether the employee is currently active (tracked). Set to `false` to deactivate. */
  active?: boolean | null;
};

/** Query params for filtering employees. */
export type EmployeeListQuery = {
  /** Comma-separated department UUIDs (OR logic). */
  department_ids?: string[];
  /** Full-text search query (searches PIN and name). */
  q?: string;
  active?: string;
};

function buildEmployeeListParams(filter: EmployeeListQuery = {}): string {
  const params = new URLSearchParams();
  if (filter.department_ids && filter.department_ids.length > 0) {
    params.set("department_ids", filter.department_ids.join(","));
  }
  if (filter.q) params.set("q", filter.q);
  if (filter.active) params.set("active", filter.active);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** List all employees with optional filtering. Requires Viewer+. */
export function fetchEmployees(filter: EmployeeListQuery = {}): Promise<Employee[]> {
  return apiGet<Employee[]>(`employees${buildEmployeeListParams(filter)}`).json();
}

/** Get a single employee by ID. Requires Viewer+. */
export function fetchEmployee(id: string): Promise<Employee> {
  return apiGet<Employee>(`employees/${encodeURIComponent(id)}`).json();
}

/** Create a new employee. Requires Admin. */
export function createEmployee(req: CreateEmployeeRequest): Promise<Employee> {
  return apiPost<Employee>("employees", req).json();
}

/** Update an employee. Requires Admin. */
export function updateEmployee(id: string, req: UpdateEmployeeRequest): Promise<Employee> {
  return apiPut<Employee>(`employees/${encodeURIComponent(id)}`, req).json();
}

/** Deactivate an employee (soft delete). Requires Admin. */
export function deactivateEmployee(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`employees/${encodeURIComponent(id)}`).json();
}

// ── Employee Attendance Queries ────────────────────────────────────────────

/** Matches the Rust `WorkDayResponse` DTO. */
export type WorkDay = {
  /** ISO date string (e.g. "2026-07-18"). */
  date: string;
  user_pin: string;
  status: string;
  total_regular_seconds: number;
  total_break_seconds: number;
  total_overtime_seconds: number;
  net_work_seconds: number;
  is_present_now: boolean;
  anomaly_count: number;
  periods: WorkPeriod[];
};

/** Matches the Rust `WorkPeriodResponse` DTO. */
export type WorkPeriod = {
  /** Unix timestamp (seconds) of check-in. */
  check_in: number;
  /** Unix timestamp (seconds) of check-out (null = still present). */
  check_out?: number | null;
  /** Duration in seconds. */
  duration_secs: number;
  /** Period kind: "regular", "overtime", "break". */
  kind: string;
};

/** Matches the Rust `EmployeeWorkDaysResponse` DTO. */
export type EmployeeWorkDaysResponse = {
  user_pin: string;
  work_days: WorkDay[];
};

/** @deprecated Use {@link EmployeeWorkDaysResponse} instead. */
export type EmployeeWorkDays = EmployeeWorkDaysResponse;

/** Matches the Rust `EmployeeSummaryResponse` DTO. */
export type EmployeeSummary = {
  user_pin: string;
  total_days: number;
  present_days: number;
  late_days: number;
  half_days: number;
  absent_days: number;
  avg_hours_per_day: number;
  total_overtime_seconds: number;
  total_regular_seconds: number;
  work_days: WorkDay[];
};

/** Matches the Rust `MonthlyTrendResponse` DTO. */
export type MonthlyTrendPoint = {
  year: number;
  month: number;
  attendance_pct: number;
};

/** Matches the Rust `CalendarDayResponse` DTO. */
export type CalendarDay = {
  date: string;
  status_code: number;
  hours?: number | null;
  is_working_day: boolean;
};

/** Query params for work-day/list endpoints. */
export type WorkDayQuery = {
  from?: number;
  to?: number;
};

/** Fetch work days for an employee by PIN. Requires Viewer+. */
export function fetchEmployeeWorkDays(pin: string, query?: WorkDayQuery): Promise<EmployeeWorkDays> {
  const params = new URLSearchParams();
  if (query?.from) params.set("from", String(query.from));
  if (query?.to) params.set("to", String(query.to));
  const qs = params.toString();
  return apiGet<EmployeeWorkDays>(
    `employees/${encodeURIComponent(pin)}/work-days${qs ? `?${qs}` : ""}`,
  ).json();
}

/** Fetch attendance summary for an employee by PIN. Requires Viewer+. */
export function fetchEmployeeSummary(pin: string, query?: WorkDayQuery): Promise<EmployeeSummary> {
  const params = new URLSearchParams();
  if (query?.from) params.set("from", String(query.from));
  if (query?.to) params.set("to", String(query.to));
  const qs = params.toString();
  return apiGet<EmployeeSummary>(
    `employees/${encodeURIComponent(pin)}/summary${qs ? `?${qs}` : ""}`,
  ).json();
}

/** Fetch monthly trend for an employee by PIN. Requires Viewer+. */
export function fetchEmployeeMonthly(pin: string): Promise<MonthlyTrendPoint[]> {
  return apiGet<MonthlyTrendPoint[]>(
    `employees/${encodeURIComponent(pin)}/monthly`,
  ).json();
}

/** Fetch calendar days for an employee by PIN. Requires Viewer+. */
export function fetchEmployeeCalendar(
  pin: string,
  query?: WorkDayQuery,
): Promise<CalendarDay[]> {
  const params = new URLSearchParams();
  if (query?.from) params.set("from", String(query.from));
  if (query?.to) params.set("to", String(query.to));
  const qs = params.toString();
  return apiGet<CalendarDay[]>(
    `employees/${encodeURIComponent(pin)}/calendar${qs ? `?${qs}` : ""}`,
  ).json();
}

// ── Schema (Metadata System) ────────────────────────────────────────────────

/** Fetch entity schema for employees (column metadata, sortability, filterability). */
export function fetchEmployeeSchema(): Promise<EntitySchema> {
  return apiGet<EntitySchema>("employees/schema").json();
}

/**
 * Facet filter params for employee queries.
 *
 * Matches the Rust facet endpoint at GET /api/employees/filters.
 */
export type EmployeeFacetParams = {
  dimension?: string;
  search?: string;
  limit?: number;
};

function buildEmployeeFacetParams(filter: EmployeeFacetParams): string {
  const params = new URLSearchParams();
  if (filter.dimension) params.set("dimension", filter.dimension);
  if (filter.search) params.set("search", filter.search);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Fetch faceted filter metadata for employee queries. */
export function fetchEmployeeFilters(filter: EmployeeFacetParams = {}): Promise<FacetGroup[]> {
  return apiGet<FacetGroup[]>(`employees/filters${buildEmployeeFacetParams(filter)}`).json();
}
