import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { FacetGroup } from "./client";
import type { EntitySchema } from "@/types/metadata";

// ── Department CRUD ──────────────────────────────────────────────────────────

/** Matches the Rust `DepartmentResponse` DTO. */
export type Department = {
  id: string;
  name: string;
  work_policy_id?: string | null;
  work_policy_title?: string | null;
  work_policy?: WorkPolicy | null;
  employee_count?: number | null;
  created_at: number;
  updated_at: number;
};

/** Matches the Rust `WorkPolicyResponse` DTO. */
export type WorkPolicy = {
  work_start: string;
  work_end: string;
  late_threshold_minutes: number;
  min_hours_for_full_day: number;
  daily_overtime_after_hours: number;
  working_days: boolean[];
};

/** Matches the Rust `CreateDepartmentRequest` DTO. */
export type CreateDepartmentRequest = {
  /** Unique department name (e.g. "Engineering", "Warehouse"). */
  name: string;
  /** Optional work policy template ID. Set to assign a named template. */
  work_policy_id?: string | null;
  /** Optional department-specific work policy. Null = inherit org default. */
  work_policy?: WorkPolicy | null;
};

/** Matches the Rust `UpdateDepartmentRequest` DTO. All fields optional. */
export type UpdateDepartmentRequest = {
  /** New department name. */
  name?: string | null;
  /**
   * Work policy template ID.
   * - `string` → assign named template
   * - `null` → clear template assignment (fall back to org default)
   * - omitted → leave policy unchanged
   */
  work_policy_id?: string | null;
  /**
   * New work policy.
   * - `WorkPolicy` → set custom policy
   * - `null` → clear custom policy, inherit org default
   * - omitted → leave policy unchanged
   */
  work_policy?: WorkPolicy | null;
};

/** List all departments. Requires Viewer+. */
export function fetchDepartments(): Promise<Department[]> {
  return apiGet<Department[]>("departments").json();
}

/** Get a single department by ID. Requires Viewer+.
 *
 * Always includes `?include=work_policy` so the detail view's
 * Work Policy tab has the full schedule data populated.
 */
export function fetchDepartment(id: string): Promise<Department> {
  return apiGet<Department>(`departments/${encodeURIComponent(id)}?include=work_policy`).json();
}

/** Create a new department. Requires Admin. */
export function createDepartment(req: CreateDepartmentRequest): Promise<Department> {
  return apiPost<Department>("departments", req).json();
}

/** Update a department (partial — only send changed fields). Requires Admin. */
export function updateDepartment(id: string, req: UpdateDepartmentRequest): Promise<Department> {
  return apiPut<Department>(`departments/${encodeURIComponent(id)}`, req).json();
}

/** Delete a department. Requires Admin. */
export function deleteDepartment(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`departments/${encodeURIComponent(id)}`).json();
}

// ── Schema (Metadata System) ────────────────────────────────────────────────

/** Fetch entity schema for departments (column metadata, sortability, filterability). */
export function fetchDepartmentSchema(): Promise<EntitySchema> {
  return apiGet<EntitySchema>("departments/schema").json();
}

/**
 * Facet filter params for department queries.
 */
export type DepartmentFacetParams = {
  dimension?: string;
  search?: string;
  limit?: number;
};

function buildDepartmentFacetParams(filter: DepartmentFacetParams): string {
  const params = new URLSearchParams();
  if (filter.dimension) params.set("dimension", filter.dimension);
  if (filter.search) params.set("search", filter.search);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Fetch faceted filter metadata for department queries. */
export function fetchDepartmentFilters(filter: DepartmentFacetParams = {}): Promise<FacetGroup[]> {
  return apiGet<FacetGroup[]>(`departments/filters${buildDepartmentFacetParams(filter)}`).json();
}
