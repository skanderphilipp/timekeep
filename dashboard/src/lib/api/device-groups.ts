import { apiGet, apiPost, apiPut, apiDelete } from "./client";

// ── Device Group CRUD ────────────────────────────────────────────────────────

/** Matches the Rust `DeviceGroupResponse` DTO. */
export type DeviceGroup = {
  id: string;
  name: string;
  description?: string | null;
  device_count?: number | null;
  /** Department IDs assigned to this group. Empty = all departments. */
  department_ids: string[];
  created_at: number; // unix epoch seconds
  updated_at: number;
};

/** Matches the Rust `CreateDeviceGroupRequest` DTO. */
export type CreateDeviceGroupRequest = {
  /** Unique group name (e.g. "onboarding", "staff"). */
  name: string;
  /** Optional human-readable description. */
  description?: string | null;
  /** Department IDs to assign. Empty = all departments. */
  department_ids?: string[];
};

/** Matches the Rust `UpdateDeviceGroupRequest` DTO. All fields optional. */
export type UpdateDeviceGroupRequest = {
  /** New group name. */
  name?: string | null;
  /** New description. */
  description?: string | null;
  /** New department IDs. Omitted = keep existing. */
  department_ids?: string[] | null;
};

/** Matches the Rust `SetDeviceGroupRequest` DTO. */
export type SetDeviceGroupRequest = {
  /** Group ID to assign, or null to remove from group. */
  group_id: string | null;
};

// ── API Functions ────────────────────────────────────────────────────────────

/** List all device groups. Requires Viewer+. */
export function fetchDeviceGroups(): Promise<DeviceGroup[]> {
  return apiGet<DeviceGroup[]>("device-groups").json();
}

/** Get a single device group by ID (includes device_count). Requires Viewer+. */
export function fetchDeviceGroup(id: string): Promise<DeviceGroup> {
  return apiGet<DeviceGroup>(`device-groups/${encodeURIComponent(id)}`).json();
}

/** Create a new device group. Requires Admin. */
export function createDeviceGroup(req: CreateDeviceGroupRequest): Promise<DeviceGroup> {
  return apiPost<DeviceGroup>("device-groups", req).json();
}

/** Update a device group (partial — only send changed fields). Requires Admin. */
export function updateDeviceGroup(
  id: string,
  req: UpdateDeviceGroupRequest,
): Promise<DeviceGroup> {
  return apiPut<DeviceGroup>(`device-groups/${encodeURIComponent(id)}`, req).json();
}

/** Delete a device group. Requires Admin. */
export function deleteDeviceGroup(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`device-groups/${encodeURIComponent(id)}`).json();
}

// ── Device Membership ────────────────────────────────────────────────────────

/** List all devices in a group. Requires Viewer+. */
export function fetchDevicesInGroup(groupId: string): Promise<import("./devices").DeviceSummary[]> {
  return apiGet<import("./devices").DeviceSummary[]>(
    `device-groups/${encodeURIComponent(groupId)}/devices`,
  ).json();
}

/** Set a device's group membership. Requires Admin. */
export function setDeviceGroup(
  deviceSn: string,
  req: SetDeviceGroupRequest,
): Promise<{ status: string }> {
  return apiPut<{ status: string }>(`devices/${encodeURIComponent(deviceSn)}/group`, req).json();
}

// ── Sync Operations ──────────────────────────────────────────────────────────

/** Sync employees to all devices in a group, optionally filtered by department. Requires Admin. */
export function syncDeviceGroup(
  groupId: string,
  department?: string,
): Promise<{ status: string }> {
  const qs = department ? `?department=${encodeURIComponent(department)}` : "";
  return apiPost<{ status: string }>(`device-groups/${encodeURIComponent(groupId)}/sync${qs}`, {}).json();
}

/** Sync all devices with the employee database. Requires Admin. */
export function syncAllDevices(): Promise<{ status: string }> {
  return apiPost<{ status: string }>("devices/sync-all", {}).json();
}
