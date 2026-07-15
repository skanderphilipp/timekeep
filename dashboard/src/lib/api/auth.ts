import { apiGet, apiPost } from "./client";
import type { Role } from "@shared/roles";

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Setup (First-Run Onboarding) ───────────────────────────────────────────

/** Check if the system needs initial setup. */
export type SetupStatus = { setup_needed: boolean };

export function fetchSetupStatus(): Promise<SetupStatus> {
  return apiGet<SetupStatus>("status").json();
}

export type SetupRequest = {
  username: string;
  password: string;
  display_name?: string;
  workspace_name?: string;
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

// ── User Profile ───────────────────────────────────────────────────────────

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
