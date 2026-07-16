import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { FacetGroup } from "./client";
import { API_SCAN_TIMEOUT_MS } from "../constants";
import type { DeviceStatusValue } from "@shared/device-statuses";
import type { DeviceVendorValue } from "@shared/device-vendors";
import type { DeviceCommandValue } from "@shared/device-commands";
import type { EntitySchema } from "@/types/metadata";

// ── Types ──────────────────────────────────────────────────────────────────

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
  /** Whether this device was auto-registered via ADMS push (vs manually added). */
  auto_registered?: boolean;
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
  /**
   * Device group ID for department-scoped sync.
   * A device belongs to at most one group. Groups control which employees
   * get synced to which devices.
   *
   * TODO(ENTERPRISE): Add device group management UI (settings page).
   */
  group_id?: string | null;
};

/**
 * Matches the Rust `DeviceDetailResponse` DTO (GET /api/devices/{sn}).
 *
 * Enriched with identity metadata, health/connection info, capacity stats,
 * and sync status — all the data the detail page needs in one response.
 */
export type DeviceDetailResponse = DeviceConfig & {
  status: DeviceStatusValue;
  vendor: string;
  model?: string | null;
  firmware_version?: string | null;
  platform?: string | null;
  mac_address?: string | null;
  last_seen_at?: number | null;
  first_seen_at?: number | null;
  uptime_seconds?: number | null;
  adms_active: boolean;
  sdk_poll_active: boolean;
  sdk_last_poll?: number | null;
  user_count: number;
  user_capacity: number;
  record_count: number;
  record_capacity: number;
  record_usage_pct: number;
  fingerprint_count: number;
  fingerprint_capacity: number;
  face_count: number;
  face_capacity: number;
  last_sync_at?: number | null;
  last_sync_cursor?: number | null;
};

// ── Device CRUD ────────────────────────────────────────────────────────────

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

/** Fetch a single device with all enriched metadata. */
export function fetchDeviceDetail(sn: string): Promise<DeviceDetailResponse> {
  return apiGet<DeviceDetailResponse>(`devices/${encodeURIComponent(sn)}`).json();
}

// ── Device Users ────────────────────────────────────────────────────────────

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

// ── Synced Device Users (read-only, from local DB) ─────────────────────────

/** A user synced from a device and stored in the local database. */
export type SyncedUser = {
  pin: string;
  name: string;
  privilege: number;
};

/** List users synced from a specific device (from the local database). */
export function getSyncedDeviceUsers(deviceSn: string): Promise<SyncedUser[]> {
  return apiGet<SyncedUser[]>(`devices/${encodeURIComponent(deviceSn)}/synced-users`).json();
}

// ── Device Commands ────────────────────────────────────────────────────────

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

/** Restart a device. Requires Admin. */
export function restartDevice(deviceSn: string): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `devices/${encodeURIComponent(deviceSn)}/restart`,
    {},
  ).json();
}

/** Sync the device clock to the server time. Requires Admin. */
export function syncDeviceClock(deviceSn: string): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `devices/${encodeURIComponent(deviceSn)}/sync-clock`,
    {},
  ).json();
}

/** Full device re-sync (users + records). Requires Admin. */
export function resyncDevice(deviceSn: string): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `devices/${encodeURIComponent(deviceSn)}/resync`,
    {},
  ).json();
}

/** Copy users from one device to another. Requires Admin. */
export function syncDeviceToDevice(
  targetSn: string,
  sourceSn: string,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `devices/${encodeURIComponent(targetSn)}/sync-from/${encodeURIComponent(sourceSn)}`,
    {},
  ).json();
}

// ── Enrollment ─────────────────────────────────────────────────────────────

/** Matches the Rust `EnrollEmployeeRequest` DTO. */
export type EnrollEmployeeRequest = {
  /** Employee PIN on this device. */
  pin: string;
  /** Biometric types to enroll (fingerprint, face, card, password). */
  biometric_types?: string[];
};

/** Matches the Rust `DeviceEnrollmentResponse` DTO. */
export type DeviceEnrollment = {
  employee_id: string;
  pin: string;
  biometric_types: string[];
  fingerprint_count?: number;
  face_enrolled?: boolean;
};

/** Enroll an employee on a device. Requires Admin. */
export function enrollEmployee(
  deviceSn: string,
  req: EnrollEmployeeRequest,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `devices/${encodeURIComponent(deviceSn)}/enrollments`,
    req,
  ).json();
}

/** List all enrollments on a device. Requires Admin. */
export function listDeviceEnrollments(deviceSn: string): Promise<DeviceEnrollment[]> {
  return apiGet<DeviceEnrollment[]>(
    `devices/${encodeURIComponent(deviceSn)}/enrollments`,
  ).json();
}

// ── Employee Sync ──────────────────────────────────────────────────────────

/** Sync an employee to all enrolled devices. Requires Admin. */
export function syncEmployeeToDevices(employeeId: string): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `employees/${encodeURIComponent(employeeId)}/sync-to-devices`,
    {},
  ).json();
}

/** Remove an employee from all enrolled devices. Requires Admin. */
export function removeEmployeeFromDevices(employeeId: string): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `employees/${encodeURIComponent(employeeId)}/remove-from-devices`,
    {},
  ).json();
}

// ── Device Discovery & Network Scan ────────────────────────────────────────

/** A device found during a network scan or single-device probe. */
export type DiscoveredDevice = {
  reachable: boolean;
  vendor?: string | null;
  serial_number?: string | null;
  model?: string | null;
  firmware_version?: string | null;
  ip_address?: string | null;
};

/** Response from `POST /api/devices/scan`. */
export type NetworkScanResponse = {
  subnet: string;
  hosts_scanned: number;
  devices_found: number;
  devices: DiscoveredDevice[];
};

/** Request body for `POST /api/devices/scan`. */
export type ScanNetworkRequest = {
  subnet?: string;
};

/** Request body for `POST /api/devices/discover`. */
export type DiscoverDeviceRequest = {
  host: string;
  port?: number;
};

/** Scan an entire subnet for ZKTeco devices. Requires Admin. */
export function scanNetwork(body: ScanNetworkRequest): Promise<NetworkScanResponse> {
  return apiPost<NetworkScanResponse>("devices/scan", body, { timeout: API_SCAN_TIMEOUT_MS }).json();
}

/** Probe a single device at host:port to detect vendor/serial. Requires Admin. */
export function discoverDevice(body: DiscoverDeviceRequest): Promise<DiscoveredDevice> {
  return apiPost<DiscoveredDevice>("devices/discover", body).json();
}

/** Provision (register) a device after discovery. Requires Admin. */
export function provisionDevice(body: DeviceConfig): Promise<DeviceConfig> {
  return apiPost<DeviceConfig>("devices/provision", body).json();
}

// ── Schema (Metadata System) ────────────────────────────────────────────────

/** Fetch entity schema for devices (column metadata, sortability, filterability). */
export function fetchDeviceSchema(): Promise<EntitySchema> {
  return apiGet<EntitySchema>("devices/schema").json();
}

/**
 * Facet filter params for device queries.
 *
 * Matches the Rust facet endpoint at GET /api/devices/filters.
 */
export type DeviceFacetParams = {
  dimension?: string;
  search?: string;
  limit?: number;
};

function buildDeviceFacetParams(filter: DeviceFacetParams): string {
  const params = new URLSearchParams();
  if (filter.dimension) params.set("dimension", filter.dimension);
  if (filter.search) params.set("search", filter.search);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Fetch faceted filter metadata for device queries. */
export function fetchDeviceFilters(filter: DeviceFacetParams = {}): Promise<FacetGroup[]> {
  return apiGet<FacetGroup[]>(`devices/filters${buildDeviceFacetParams(filter)}`).json();
}
