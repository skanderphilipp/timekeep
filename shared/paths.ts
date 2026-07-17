/**
 * Application paths — single source of truth for all route and API paths.
 *
 * Every route and API path segment is defined once here. Pages, components,
 * and hooks use these constants instead of hardcoding paths.
 *
 * Framework-agnostic: no React, no router imports.
 */

// ═══════════════════════════════════════════════════════════════════════
// Route patterns
// ═══════════════════════════════════════════════════════════════════════

/**
 * All frontend route patterns.
 *
 * When a route pattern changes, the compiler catches every call site.
 * Route parameter placeholders use `:param` syntax.
 */
export const AppRoute = {
  dashboard: "/",
  login: "/login",
  setup: "/setup",

  devices: {
    list: "/devices",
    new: "/devices/new",
    groups: "/devices/groups",
    /** @param id — device group UUID */
    groupDetail: (id: string) => `/devices/groups/${encodeURIComponent(id)}`,
    /** @param sn — device serial number */
    detail: (sn: string) => `/devices/${encodeURIComponent(sn)}`,
    /** @param sn — device serial number */
    edit: (sn: string) => `/devices/${encodeURIComponent(sn)}/edit`,
  },

  attendance: {
    list: "/attendance",
    /** Opens the attendance list filtered to a specific device. */
    byDevice: (sn: string) => `/attendance?device_sn=${encodeURIComponent(sn)}`,
    /** Opens the attendance list filtered to a specific user PIN. */
    byUser: (pin: string) => `/attendance?user_pin=${encodeURIComponent(pin)}`,
  },

  employees: {
    list: "/employees",
    new: "/employees/new",
    /** @param id — employee UUID */
    detail: (id: string) => `/employees/${encodeURIComponent(id)}`,
    /** @param id — employee UUID */
    edit: (id: string) => `/employees/${encodeURIComponent(id)}/edit`,
  },

  reports: "/reports",

  departments: {
    list: "/departments",
    /** @param id — department UUID */
    detail: (id: string) => `/departments/${encodeURIComponent(id)}`,
  },

  workPolicies: {
    list: "/work-policies",
  },

  settings: {
    system: "/settings",
    users: "/settings/users",
    apiKeys: "/settings/api-keys",
    endpoints: "/settings/endpoints",
    audit: "/settings/audit",
  },

  // Legacy redirects — keep old URLs working during migration
  legacy: {
    users: "/users",
    endpoints: "/integrations/endpoints",
    apiKeys: "/integrations/api-keys",
    apiKeysAlt: "/api-keys",
    audit: "/audit",
  },
} as const;

/**
 * All navigable route strings (non-parameterized).
 *
 * Useful for route matching and breadcrumb resolution.
 * Parameterized routes like `/devices/:sn/edit` are NOT included
 * — they're accessed via their factory functions.
 */
export const ALL_ROUTE_PATHS = [
  AppRoute.dashboard,
  AppRoute.login,
  AppRoute.setup,
  AppRoute.devices.list,
  AppRoute.devices.new,
  AppRoute.devices.groups,
  AppRoute.departments.list,
  AppRoute.workPolicies.list,
  AppRoute.attendance.list,
  AppRoute.employees.list,
  AppRoute.employees.new,
  AppRoute.reports,
  AppRoute.settings.system,
  AppRoute.settings.users,
  AppRoute.settings.apiKeys,
  AppRoute.settings.endpoints,
  AppRoute.settings.audit,
  // Legacy
  AppRoute.legacy.users,
  AppRoute.legacy.endpoints,
  AppRoute.legacy.apiKeys,
  AppRoute.legacy.apiKeysAlt,
  AppRoute.legacy.audit,
] as const;

// ═══════════════════════════════════════════════════════════════════════
// API path segments
// ═══════════════════════════════════════════════════════════════════════

/**
 * API path segments — used when constructing fetch URLs for the backend.
 *
 * Mirrors the Rust route mount points in `crates/timekeep-api/src/routes/`.
 * Each segment is a path fragment relative to `/api/`.
 */
export const ApiPath = {
  health: "health",
  login: "login",
  /** First-run setup — returns { setup_needed: bool } */
  status: "status",
  /** Create initial admin user */
  setup: "setup",
  /** Bootstrap config — workspace branding, version, setup status, feature flags */
  clientConfig: "client-config",
  me: "me",
  permissions: "permissions",

  devices: "devices",
  /** Device-specific operations: `devices/{sn}/users`, `devices/{sn}/commands` */
  device: (sn: string) => `devices/${encodeURIComponent(sn)}`,

  punches: "punches",
  /** Cursor-based paginated punch endpoint. */
  punchesCursor: "punches/cursor",

  dashboard: {
    today: "dashboard/today",
  },

  reports: {
    summary: "reports/summary",
    export: "reports/export",
  },

  endpoints: "endpoints",
  /** Integration kinds metadata. */
  integrationKinds: "integration-kinds",

  settings: "settings",

  apiKeys: "api-keys",
  /** Revoke a specific API key. */
  revokeApiKey: (id: string) => `api-keys/${encodeURIComponent(id)}/revoke`,

  audit: "audit",

  employees: "employees",

  departments: "departments",
  /** Department-specific operations. */
  department: (id: string) => `departments/${encodeURIComponent(id)}`,

  workPolicies: "work-policies",
  /** Work-policy-template-specific operations. */
  workPolicy: (id: string) => `work-policies/${encodeURIComponent(id)}`,

  deviceGroups: "device-groups",
  /** Device-group-specific operations. */
  deviceGroup: (id: string) => `device-groups/${encodeURIComponent(id)}`,
  /** List devices in a group. */
  deviceGroupDevices: (id: string) => `device-groups/${encodeURIComponent(id)}/devices`,
  /** Sync a device group. */
  deviceGroupSync: (id: string) => `device-groups/${encodeURIComponent(id)}/sync`,
  /** Sync all devices. */
  devicesSyncAll: "devices/sync-all",
  /** Employee-specific operations. */
  employee: (id: string) => `employees/${encodeURIComponent(id)}`,

  users: "users",
  /** User-specific operations. */
  user: (id: string) => `users/${encodeURIComponent(id)}`,
  /** Change user password. */
  changePassword: (id: string) => `users/${encodeURIComponent(id)}/password`,
} as const;
