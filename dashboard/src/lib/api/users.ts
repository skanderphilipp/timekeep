import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { Role } from "@shared/roles";

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── CRUD ───────────────────────────────────────────────────────────────────

/** List all dashboard users. Requires Admin or Operator. */
export function fetchUsers(): Promise<DashboardUser[]> {
  return apiGet<DashboardUser[]>("users").json();
}

/** Get a single dashboard user by ID. Requires Admin or Operator. */
export function fetchUser(id: string): Promise<DashboardUser> {
  return apiGet<DashboardUser>(`users/${encodeURIComponent(id)}`).json();
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
