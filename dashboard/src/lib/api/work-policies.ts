import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { FacetGroup } from "./client";
import type { EntitySchema } from "@/types/metadata";

// ── Types ────────────────────────────────────────────────────────────────────────

/** Matches the Rust `WorkPolicyTemplateResponse` DTO. */
export type WorkPolicyTemplate = {
  id: string;
  title: string;
  description?: string | null;
  work_start: string; // "HH:MM"
  work_end: string; // "HH:MM"
  late_threshold_minutes: number;
  min_hours_for_full_day: number;
  daily_overtime_after_hours: number;
  working_days: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  created_at: number;
  updated_at: number;
};

/** Matches the Rust `CreateWorkPolicyTemplateRequest` DTO. */
export type CreateWorkPolicyTemplateRequest = {
  title: string;
  description?: string | null;
  work_start: string;
  work_end: string;
  late_threshold_minutes?: number; // default: 15
  min_hours_for_full_day?: number; // default: 4.0
  daily_overtime_after_hours?: number; // default: 8.0
  working_days?: boolean[]; // default: Mon-Fri
};

/** Matches the Rust `UpdateWorkPolicyTemplateRequest` DTO. All fields optional. */
export type UpdateWorkPolicyTemplateRequest = {
  title?: string;
  description?: string | null;
  work_start?: string;
  work_end?: string;
  late_threshold_minutes?: number;
  min_hours_for_full_day?: number;
  daily_overtime_after_hours?: number;
  working_days?: boolean[];
};

// ── CRUD ─────────────────────────────────────────────────────────────────────────

/** List all work policy templates. Requires Viewer+. */
export function fetchWorkPolicyTemplates(): Promise<WorkPolicyTemplate[]> {
  return apiGet<WorkPolicyTemplate[]>("work-policies").json();
}

/** Get a single work policy template by ID. Requires Viewer+. */
export function fetchWorkPolicyTemplate(id: string): Promise<WorkPolicyTemplate> {
  return apiGet<WorkPolicyTemplate>(`work-policies/${encodeURIComponent(id)}`).json();
}

/** Create a new work policy template. Requires Admin. */
export function createWorkPolicyTemplate(req: CreateWorkPolicyTemplateRequest): Promise<WorkPolicyTemplate> {
  return apiPost<WorkPolicyTemplate>("work-policies", req).json();
}

/** Update a work policy template (partial — only send changed fields). Requires Admin. */
export function updateWorkPolicyTemplate(
  id: string,
  req: UpdateWorkPolicyTemplateRequest,
): Promise<WorkPolicyTemplate> {
  return apiPut<WorkPolicyTemplate>(`work-policies/${encodeURIComponent(id)}`, req).json();
}

/** Delete a work policy template. Requires Admin. */
export function deleteWorkPolicyTemplate(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`work-policies/${encodeURIComponent(id)}`).json();
}

// ── Schema (Metadata System) ─────────────────────────────────────────────────────

/** Fetch entity schema for work policy templates (column metadata, sortability, filterability). */
export function fetchWorkPolicyTemplateSchema(): Promise<EntitySchema> {
  return apiGet<EntitySchema>("work-policies/schema").json();
}

/** Fetch facet filter metadata for work policy template queries. */
export function fetchWorkPolicyTemplateFilters(): Promise<FacetGroup[]> {
  return apiGet<FacetGroup[]>("work-policies/filters").json();
}
