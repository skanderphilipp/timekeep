import { apiGet, apiPut } from "./client";
import type { WorkPolicy } from "./departments";

// ── System Settings ─────────────────────────────────────────────────────────

/** Matches the Rust `SystemSettings` / `SystemSettingsResponse` DTO. */
export type SystemSettings = {
  poll_interval_secs: number;
  auto_discover: boolean;
  /** Organization-default work policy. Nullable — falls back to hardcoded defaults. */
  work_policy?: WorkPolicy | null;
  /** Support email shown in the dashboard UI. */
  support_email: string;
  /** Workspace/company name shown on the login page. */
  workspace_name: string;
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

// ── Health ─────────────────────────────────────────────────────────────────

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
