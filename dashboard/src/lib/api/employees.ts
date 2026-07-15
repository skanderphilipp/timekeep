import { apiGet, apiPost, apiPut, apiDelete } from "./client";

// ── Employee CRUD ──────────────────────────────────────────────────────────

/** Matches the Rust `Employee` model. */
export type Employee = {
  id: string;
  pin: string;
  name: string;
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
  department?: string | null;
  external_id?: string | null;
};

/** Matches the Rust `UpdateEmployeeRequest` DTO. */
export type UpdateEmployeeRequest = {
  name?: string | null;
  department?: string | null;
  external_id?: string | null;
};

/** List all employees. Requires Viewer+. */
export function fetchEmployees(): Promise<Employee[]> {
  return apiGet<Employee[]>("employees").json();
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
  date: number;
  status: string;
  check_in?: number | null;
  check_out?: number | null;
  regular_seconds: number;
  overtime_seconds: number;
  break_seconds: number;
  is_anomaly: boolean;
};

/** Matches the Rust `EmployeeWorkDaysResponse` DTO. */
export type EmployeeWorkDays = {
  user_pin: string;
  work_days: WorkDay[];
};

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
};

/** Matches the Rust `MonthlyTrendPoint` DTO. */
export type MonthlyTrendPoint = {
  month: string;
  present_days: number;
  absent_days: number;
  late_days: number;
  avg_hours_per_day: number;
};

/** Matches the Rust `CalendarDay` DTO. */
export type CalendarDay = {
  date: number;
  status: string;
  check_in?: number | null;
  check_out?: number | null;
  regular_seconds: number;
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
