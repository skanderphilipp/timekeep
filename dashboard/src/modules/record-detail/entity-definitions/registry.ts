import type { EntityType } from "@/types/entities";
import type { EntityDefinition, DetailViewConfig } from "./types";
import { QueryKeys } from "@/lib/query-keys";

// ── Fetch / update / create functions ──
import { fetchEmployee, updateEmployee, createEmployee } from "@/lib/api/employees";
import { fetchDepartment, updateDepartment, createDepartment } from "@/lib/api/departments";
import { fetchDeviceDetail, updateDevice } from "@/lib/api/devices";
import { fetchUser, updateUser } from "@/lib/api/users";
import { fetchPunch } from "@/lib/api/punches";
import { fetchDeviceGroup, updateDeviceGroup, createDeviceGroup } from "@/lib/api/device-groups";
import { fetchWorkPolicyTemplate, updateWorkPolicyTemplate, createWorkPolicyTemplate } from "@/lib/api/work-policies";
import { fetchApiKey, createApiKey } from "@/lib/api/apikeys";
import { fetchAuditEvent } from "@/lib/api/audit";
import { fetchEndpoint, updateEndpoint, createEndpoint } from "@/lib/api/integrations";

// ── Action factories ──
import {
  deviceActionFactory,
  employeeActionFactory,
  departmentActionFactory,
  deviceGroupActionFactory,
  apiKeyActionFactory,
  defaultActionFactory,
} from "./action-factories";

// ── Inline Detail Configs ──────────────────────────────────────────────────

const employeeDetailConfig: DetailViewConfig = {
  nameField: "name",
  sections: [
    {
      title: "Identity",
      fields: [
        {
          fieldId: "name",
          label: "Name",
          type: "text",
          metadata: { fieldName: "name" },
          editable: true,
        },
        {
          fieldId: "pin",
          label: "PIN",
          type: "text",
          metadata: { fieldName: "pin" },
          editable: false,
        },
        {
          fieldId: "department",
          label: "Department",
          type: "reference",
          metadata: {
            fieldName: "department",
            referenceEntity: "department",
            referenceIdField: "department_id",
            displayField: "department",
          },
          editable: true,
        },
        {
          fieldId: "external_id",
          label: "External ID",
          type: "text",
          metadata: { fieldName: "external_id" },
          editable: true,
        },
        {
          fieldId: "active",
          label: "Status",
          type: "status",
          metadata: {
            fieldName: "active",
            labels: { true: "Active", false: "Inactive" },
            colors: { true: "green", false: "gray" },
          },
          editable: true,
        },
        {
          fieldId: "created_at",
          label: "Created",
          type: "timestamp",
          metadata: {
            fieldName: "created_at",
            format: "date-only",
          },
          editable: false,
        },
      ],
    },
  ],
  kpis: [
    { key: "present_days", label: "Present Days", format: (v) => String(v) },
    { key: "avg_hours_per_day", label: "Avg Hours/Day", format: (v) => `${v.toFixed(1)}h` },
    { key: "late_days", label: "Late Days", format: (v) => String(v) },
    { key: "absent_days", label: "Absent Days", format: (v) => String(v) },
  ],
};

const departmentDetailConfig: DetailViewConfig = {
  nameField: "name",
  tabs: [
    {
      key: "details",
      title: "Details",
      sections: [
        {
          title: "Overview",
          fields: [
            { fieldId: "name", label: "Name", type: "text", metadata: { fieldName: "name" }, editable: true },
            {
              fieldId: "employee_count",
              label: "Employees",
              type: "number",
              metadata: { fieldName: "employee_count" },
              editable: false,
            },
            {
              fieldId: "created_at",
              label: "Created",
              type: "timestamp",
              metadata: { fieldName: "created_at", format: "date-only" },
              editable: false,
            },
          ],
        },
      ],
    },
    {
      key: "policy",
      title: "Work Policy",
      sections: [
        {
          title: "Overview",
          fields: [
            {
              fieldId: "work_policy_title",
              label: "Assigned Policy",
              type: "reference",
              metadata: {
                fieldName: "work_policy",
                referenceEntity: "work_policy",
                referenceIdField: "work_policy_id",
                displayField: "work_policy_title",
              },
              editable: true,
            },
          ],
        },
        {
          title: "Schedule",
          fields: [
            {
              fieldId: "work_policy.work_start",
              label: "Work Start",
              type: "text",
              metadata: { fieldName: "work_start", inputType: "time" },
              editable: true,
            },
            {
              fieldId: "work_policy.work_end",
              label: "Work End",
              type: "text",
              metadata: { fieldName: "work_end", inputType: "time" },
              editable: true,
            },
            {
              fieldId: "work_policy.late_threshold_minutes",
              label: "Late Threshold (min)",
              type: "number",
              metadata: { fieldName: "late_threshold_minutes" },
              editable: true,
            },
            {
              fieldId: "work_policy.min_hours_for_full_day",
              label: "Min Hours / Full Day",
              type: "number",
              metadata: { fieldName: "min_hours_for_full_day" },
              editable: true,
            },
            {
              fieldId: "work_policy.daily_overtime_after_hours",
              label: "Overtime After (h)",
              type: "number",
              metadata: { fieldName: "daily_overtime_after_hours" },
              editable: true,
            },
            {
              fieldId: "work_policy.working_days",
              label: "Working Days",
              type: "array",
              metadata: {
                fieldName: "working_days",
                positionLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
              },
              editable: false,
            },
          ],
        },
      ],
    },
  ],
};

const workPolicyDetailConfig: DetailViewConfig = {
  nameField: "title",
  sections: [
    {
      title: "Schedule",
      fields: [
        {
          fieldId: "title",
          label: "Title",
          type: "text",
          metadata: { fieldName: "title" },
          editable: true,
        },
        {
          fieldId: "description",
          label: "Description",
          type: "text",
          metadata: { fieldName: "description" },
          editable: true,
        },
        {
          fieldId: "work_start",
          label: "Work Start",
          type: "text",
          metadata: { fieldName: "work_start", inputType: "time" },
          editable: true,
        },
        {
          fieldId: "work_end",
          label: "Work End",
          type: "text",
          metadata: { fieldName: "work_end", inputType: "time" },
          editable: true,
        },
        {
          fieldId: "late_threshold_minutes",
          label: "Late Threshold (min)",
          type: "number",
          metadata: { fieldName: "late_threshold_minutes" },
          editable: true,
        },
        {
          fieldId: "min_hours_for_full_day",
          label: "Min Hours / Full Day",
          type: "number",
          metadata: { fieldName: "min_hours_for_full_day" },
          editable: true,
        },
        {
          fieldId: "daily_overtime_after_hours",
          label: "Overtime After (h)",
          type: "number",
          metadata: { fieldName: "daily_overtime_after_hours" },
          editable: true,
        },
        {
          fieldId: "working_days",
          label: "Working Days",
          type: "array",
          metadata: {
            fieldName: "working_days",
            positionLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          },
          editable: true,
        },
      ],
    },
  ],
};

const deviceDetailConfig: DetailViewConfig = {
  nameField: "label",
  tabs: [
    {
      key: "info",
      title: "Overview",
      sections: [
        {
          title: "Connection",
          fields: [
            { fieldId: "host", label: "Host", type: "text", metadata: { fieldName: "host" }, editable: true },
            { fieldId: "port", label: "Port", type: "number", metadata: { fieldName: "port" }, editable: true },
            { fieldId: "serial_number", label: "Serial Number", type: "text", metadata: { fieldName: "serial_number" }, editable: false },
            { fieldId: "vendor", label: "Vendor", type: "text", metadata: { fieldName: "vendor" }, editable: true },
            {
              fieldId: "group_id",
              label: "Group",
              type: "reference",
              metadata: { fieldName: "group_name", referenceEntity: "device_group", referenceIdField: "group_id", displayField: "group_name" },
              editable: true,
            },
          ],
        },
        {
          title: "Hardware",
          fields: [
            { fieldId: "model", label: "Model", type: "text", metadata: { fieldName: "model" }, editable: true },
            { fieldId: "firmware_version", label: "Firmware", type: "text", metadata: { fieldName: "firmware_version" }, editable: false },
            { fieldId: "platform", label: "Platform", type: "text", metadata: { fieldName: "platform" }, editable: false },
            { fieldId: "mac_address", label: "MAC Address", type: "text", metadata: { fieldName: "mac_address" }, editable: false },
          ],
        },
        {
          title: "Connection Status",
          fields: [
            {
              fieldId: "status",
              label: "State",
              type: "status",
              metadata: { fieldName: "status", labels: { online: "Online", offline: "Offline" }, colors: { online: "green", offline: "red" } },
              editable: false,
            },
            { fieldId: "last_seen", label: "Last Seen", type: "timestamp", metadata: { fieldName: "last_seen" }, editable: false },
            {
              fieldId: "push_enabled",
              label: "Push Enabled",
              type: "status",
              metadata: { fieldName: "push_enabled", labels: { true: "Yes", false: "No" }, colors: { true: "green", false: "gray" } },
              editable: true,
            },
            {
              fieldId: "adms_active",
              label: "ADMS Active",
              type: "status",
              metadata: { fieldName: "adms_active", labels: { true: "Yes", false: "No" }, colors: { true: "green", false: "gray" } },
              editable: false,
            },
            {
              fieldId: "sdk_poll_active",
              label: "SDK Poll",
              type: "status",
              metadata: { fieldName: "sdk_poll_active", labels: { true: "Active", false: "Inactive" }, colors: { true: "green", false: "gray" } },
              editable: false,
            },
          ],
        },
        {
          title: "Capacity",
          fields: [
            { fieldId: "user_count", label: "Users", type: "text", metadata: { fieldName: "user_count" }, editable: false },
            { fieldId: "record_count", label: "Records", type: "text", metadata: { fieldName: "record_count" }, editable: false },
            { fieldId: "fingerprint_count", label: "Fingerprints", type: "text", metadata: { fieldName: "fingerprint_count" }, editable: false },
            { fieldId: "record_usage_pct", label: "Record Storage", type: "number", metadata: { fieldName: "record_usage_pct" }, editable: false },
            { fieldId: "last_sync_at", label: "Last Sync", type: "timestamp", metadata: { fieldName: "last_sync_at" }, editable: false },
          ],
        },
      ],
    },
    { key: "users", title: "Users", sections: [], tabToolbar: true },
    { key: "config", title: "Config", sections: [] },
    { key: "activity", title: "Activity", sections: [] },
  ],
};

const punchDetailConfig: DetailViewConfig = {
  nameField: "user_pin",
  sections: [
    {
      title: "Details",
      fields: [
        {
          fieldId: "employee_name",
          label: "Employee",
          type: "reference",
          metadata: { fieldName: "employee_name", referenceEntity: "employee", referenceIdField: "user_pin", displayField: "employee_name" },
          editable: false,
        },
        { fieldId: "timestamp", label: "Time", type: "timestamp", metadata: { fieldName: "timestamp" }, editable: false },
        {
          fieldId: "status",
          label: "Status",
          type: "status",
          metadata: { fieldName: "status", labels: { check_in: "Check In", check_out: "Check Out" }, colors: { check_in: "green", check_out: "blue" } },
          editable: false,
        },
        { fieldId: "verify_mode", label: "Method", type: "text", metadata: { fieldName: "verify_mode" }, editable: false },
        {
          fieldId: "device_label",
          label: "Device",
          type: "reference",
          metadata: { fieldName: "device_label", referenceEntity: "device", referenceIdField: "device_sn", displayField: "device_label" },
          editable: false,
        },
        { fieldId: "work_code", label: "Work Code", type: "text", metadata: { fieldName: "work_code" }, editable: false },
      ],
    },
    {
      title: "Flags",
      fields: [
        {
          fieldId: "is_anomaly",
          label: "Status",
          type: "status",
          metadata: { fieldName: "is_anomaly", labels: { true: "Anomaly", false: "Normal" }, colors: { true: "amber", false: "green" } },
          editable: false,
        },
        { fieldId: "anomaly_type", label: "Type", type: "text", metadata: { fieldName: "anomaly_type" }, editable: false },
      ],
    },
  ],
};

const userDetailConfig: DetailViewConfig = {
  nameField: "username",
  sections: [
    {
      title: "Account",
      fields: [
        { fieldId: "username", label: "Username", type: "text", metadata: { fieldName: "username" }, editable: true },
        { fieldId: "display_name", label: "Display Name", type: "text", metadata: { fieldName: "display_name" }, editable: true },
        {
          fieldId: "role",
          label: "Role",
          type: "status",
          metadata: { fieldName: "role", labels: { admin: "Admin", operator: "Operator", viewer: "Viewer" }, colors: { admin: "green", operator: "amber", viewer: "gray" } },
          editable: false,
        },
        {
          fieldId: "active",
          label: "Status",
          type: "status",
          metadata: { fieldName: "active", labels: { true: "Active", false: "Inactive" }, colors: { true: "green", false: "gray" } },
          editable: false,
        },
        { fieldId: "created_at", label: "Created", type: "timestamp", metadata: { fieldName: "created_at", format: "date-only" }, editable: false },
        { fieldId: "updated_at", label: "Updated", type: "timestamp", metadata: { fieldName: "updated_at", format: "date-only" }, editable: false },
      ],
    },
  ],
};

const apiKeyDetailConfig: DetailViewConfig = {
  nameField: "name",
  sections: [
    {
      title: "Details",
      fields: [
        { fieldId: "name", label: "Name", type: "text", metadata: { fieldName: "name" }, editable: true },
        { fieldId: "prefix", label: "Key Prefix", type: "text", metadata: { fieldName: "prefix" }, editable: false },
        {
          fieldId: "revoked",
          label: "Status",
          type: "status",
          metadata: { fieldName: "revoked", labels: { true: "Revoked", false: "Active" }, colors: { true: "red", false: "green" } },
          editable: false,
        },
        { fieldId: "permissions", label: "Permissions", type: "text", metadata: { fieldName: "permissions" }, editable: false },
        { fieldId: "created_by", label: "Created By", type: "text", metadata: { fieldName: "created_by" }, editable: false },
        { fieldId: "created_at", label: "Created", type: "timestamp", metadata: { fieldName: "created_at", format: "date-only" }, editable: false },
        { fieldId: "expires_at", label: "Expires", type: "timestamp", metadata: { fieldName: "expires_at", format: "date-only" }, editable: false },
        { fieldId: "last_used_at", label: "Last Used", type: "timestamp", metadata: { fieldName: "last_used_at", format: "date-only" }, editable: false },
      ],
    },
  ],
};

const auditDetailConfig: DetailViewConfig = {
  nameField: "action",
  sections: [
    {
      title: "Event",
      fields: [
        { fieldId: "actor", label: "Actor", type: "text", metadata: { fieldName: "actor" }, editable: false },
        { fieldId: "action", label: "Action", type: "text", metadata: { fieldName: "action" }, editable: false },
        { fieldId: "resource", label: "Resource", type: "text", metadata: { fieldName: "resource" }, editable: false },
        { fieldId: "timestamp", label: "Timestamp", type: "timestamp", metadata: { fieldName: "timestamp" }, editable: false },
        {
          fieldId: "status",
          label: "Status",
          type: "status",
          metadata: { fieldName: "status", labels: { success: "Success", failed: "Failed" }, colors: { success: "green", failed: "red" } },
          editable: false,
        },
      ],
    },
  ],
};

const deviceGroupDetailConfig: DetailViewConfig = {
  nameField: "name",
  tabs: [
    {
      key: "details",
      title: "Details",
      icon: "info-circle",
      sections: [
        {
          title: "Info",
          fields: [
            { fieldId: "name", label: "Name", type: "text", metadata: { fieldName: "name" }, editable: true },
            { fieldId: "device_count", label: "Devices", type: "number", metadata: { fieldName: "device_count" }, editable: false },
            { fieldId: "department_ids", label: "Departments", type: "array", metadata: { fieldName: "department_ids", referenceEntity: "department" }, editable: true },
            { fieldId: "description", label: "Description", type: "text", metadata: { fieldName: "description" }, editable: true },
            { fieldId: "created_at", label: "Created", type: "timestamp", metadata: { fieldName: "created_at", format: "date-only" }, editable: false },
            { fieldId: "updated_at", label: "Updated", type: "timestamp", metadata: { fieldName: "updated_at", format: "date-only" }, editable: false },
          ],
        },
      ],
    },
    { key: "devices", title: "Devices", icon: "devices", sections: [] },
    { key: "sync", title: "Sync", icon: "refresh", sections: [] },
  ],
};

const endpointDetailConfig: DetailViewConfig = {
  nameField: "name",
  sections: [
    {
      title: "Configuration",
      fields: [
        { fieldId: "name", label: "Name", type: "text", metadata: { fieldName: "name" }, editable: true },
        { fieldId: "kind", label: "Type", type: "text", metadata: { fieldName: "kind" }, editable: true },
        {
          fieldId: "enabled",
          label: "Status",
          type: "status",
          metadata: { fieldName: "enabled", labels: { true: "Enabled", false: "Disabled" }, colors: { true: "green", false: "gray" } },
          editable: false,
        },
        { fieldId: "created_at", label: "Created", type: "timestamp", metadata: { fieldName: "created_at", format: "date-only" }, editable: false },
        { fieldId: "updated_at", label: "Updated", type: "timestamp", metadata: { fieldName: "updated_at", format: "date-only" }, editable: false },
      ],
    },
  ],
};

/**
 * Complete entity definition registry.
 *
 * ONE place to define how any entity behaves in detail views.
 * All detailConfigs are inlined directly — no separate registry to keep in sync.
 *
 * To add a new entity:
 *   1. Add an entry here with its detailConfig, fetch function, and actions.
 *   2. Done — no separate registries to maintain.
 */
export const ENTITY_DEFINITIONS: Record<EntityType, EntityDefinition> = {
  // ── Employee ────────────────────────────────────────────────────
  employee: {
    entityType: "employee",
    idField: "id",
    fetchById: (id) => fetchEmployee(id) as Promise<Record<string, unknown>>,
    updateById: (id, field, value) =>
      updateEmployee(id, { [field]: value }) as Promise<Record<string, unknown>>,
    createFn: (data) => createEmployee(data as import("@/lib/api/employees").CreateEmployeeRequest) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.employees.list(),
    detailConfig: employeeDetailConfig,
    actionFactory: employeeActionFactory,
  },

  // ── Department ──────────────────────────────────────────────────
  department: {
    entityType: "department",
    idField: "id",
    fetchById: (id) => fetchDepartment(id) as Promise<Record<string, unknown>>,
    updateById: (id, field, value) =>
      updateDepartment(id, { [field]: value }) as Promise<Record<string, unknown>>,
    createFn: (data) => createDepartment(data as import("@/lib/api/departments").CreateDepartmentRequest) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.departments.list(),
    detailConfig: departmentDetailConfig,
    actionFactory: departmentActionFactory,
  },

  // ── Device ──────────────────────────────────────────────────────
  device: {
    entityType: "device",
    idField: "serial_number",
    fetchById: (sn) => fetchDeviceDetail(sn) as Promise<Record<string, unknown>>,
    updateById: (sn, field, value) =>
      updateDevice(sn, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.devices.list(),
    detailConfig: deviceDetailConfig,
    actionFactory: deviceActionFactory,
  },

  // ── User ────────────────────────────────────────────────────────
  // Note: User creation is handled by CreateUserDialog (password masking,
  // role dropdown, Zod validation) — NOT the record detail create flow.
  user: {
    entityType: "user",
    idField: "id",
    fetchById: (id) => fetchUser(id) as Promise<Record<string, unknown>>,
    updateById: (id, field, value) =>
      updateUser(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.users.list(),
    detailConfig: userDetailConfig,
    actionFactory: defaultActionFactory,
  },

  // ── Punch ───────────────────────────────────────────────────────
  punch: {
    entityType: "punch",
    idField: "id",
    fetchById: (id) => fetchPunch(id) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.punches.list({}),
    detailConfig: punchDetailConfig,
    actionFactory: defaultActionFactory,
  },

  // ── Device Group ────────────────────────────────────────────────
  device_group: {
    entityType: "device_group",
    idField: "id",
    fetchById: (id) => fetchDeviceGroup(id) as Promise<Record<string, unknown>>,
    updateById: (id, field, value) =>
      updateDeviceGroup(id, { [field]: value }) as Promise<Record<string, unknown>>,
    createFn: (data) => createDeviceGroup(data as import("@/lib/api/device-groups").CreateDeviceGroupRequest) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.deviceGroups.list(),
    detailConfig: deviceGroupDetailConfig,
    actionFactory: deviceGroupActionFactory,
  },

  // ── Work Policy ─────────────────────────────────────────────────
  work_policy: {
    entityType: "work_policy",
    idField: "id",
    fetchById: (id) => fetchWorkPolicyTemplate(id) as Promise<Record<string, unknown>>,
    updateById: (id, field, value) =>
      updateWorkPolicyTemplate(id, { [field]: value }) as Promise<Record<string, unknown>>,
    createFn: (data) => createWorkPolicyTemplate(data as import("@/lib/api/work-policies").CreateWorkPolicyTemplateRequest) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.workPolicies.list(),
    detailConfig: workPolicyDetailConfig,
    actionFactory: defaultActionFactory,
  },

  // ── API Key ─────────────────────────────────────────────────────
  api_key: {
    entityType: "api_key",
    idField: "id",
    fetchById: (id) => fetchApiKey(id) as Promise<Record<string, unknown>>,
    createFn: (data) => createApiKey(data as import("@/lib/api/apikeys").CreateApiKeyRequest) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.apiKeys.list(),
    detailConfig: apiKeyDetailConfig,
    actionFactory: apiKeyActionFactory,
  },

  // ── Audit ───────────────────────────────────────────────────────
  audit: {
    entityType: "audit",
    idField: "id",
    fetchById: (id) => fetchAuditEvent(id) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.audit.list({}),
    detailConfig: auditDetailConfig,
    actionFactory: defaultActionFactory,
  },

  // ── Integration Endpoint ────────────────────────────────────────
  endpoint: {
    entityType: "endpoint",
    idField: "id",
    fetchById: (id) => fetchEndpoint(id) as Promise<Record<string, unknown>>,
    updateById: (id, field, value) =>
      updateEndpoint(id, { [field]: value }) as Promise<Record<string, unknown>>,
    createFn: (data) => createEndpoint(data as import("@/lib/api/integrations").CreateEndpointRequest) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.endpoints.list(),
    detailConfig: endpointDetailConfig,
    actionFactory: defaultActionFactory,
  },
};
