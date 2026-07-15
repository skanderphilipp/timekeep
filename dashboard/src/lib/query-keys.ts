/**
 * TanStack Query key factory — single source of truth for all query keys.
 *
 * Every query and mutation in the app uses keys from this factory.
 * This ensures consistent cache invalidation and prevents key collisions.
 *
 * Usage:
 *   useQuery({ queryKey: QueryKeys.devices.list(), queryFn: fetchDevices })
 *   queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all })
 */

// ═══════════════════════════════════════════════════════════════════════
// Query Key Factory
// ═══════════════════════════════════════════════════════════════════════

export const QueryKeys = {
  /** Auth / current user */
  auth: {
    /** Current authenticated user profile ("me"). */
    me: () => ["me"] as const,
    /** Public about/workspace info (shown on login page). */
    about: () => ["about"] as const,
  },

  /** Dashboard overview */
  dashboard: {
    /** Today's attendance summary. */
    today: () => ["today-summary"] as const,
  },

  /** Devices */
  devices: {
    /** All devices (invalidate with `QueryKeys.devices.all`). */
    all: ["devices"] as const,
    /** Full device list. */
    list: () => ["devices"] as const,
    /** Single device by serial number. */
    detail: (sn: string) => ["device", sn] as const,
    /** Enriched device detail (DeviceDetailResponse). */
    detailEnriched: (sn: string) => ["device", sn, "enriched"] as const,
    /** Synced users from local DB for a device. */
    syncedUsers: (sn: string) => ["device", sn, "synced-users"] as const,
    /** Device enrollments. */
    enrollments: (sn: string) => ["device", sn, "enrollments"] as const,
    /** Device activity feed. */
    activity: (sn: string) => ["device", sn, "activity"] as const,
    /** Devices health overview. */
    health: () => ["devices", "health"] as const,
    /** Entity schema (column metadata). Cached indefinitely. */
    schema: () => ["schema", "device"] as const,
    /** Facet filter metadata. */
    filters: <T extends Record<string, unknown>>(filter: T) => ["device-filters", filter] as const,
  },

  /** Punches / attendance records */
  punches: {
    /** All punch queries (invalidate with `QueryKeys.punches.all`). */
    all: ["punches"] as const,
    /** Paginated punch query with filters. */
    list: <T extends Record<string, unknown>>(filter: T) => ["punches", filter] as const,
    /** Cursor-based infinite punch query. */
    infinite: <T extends Record<string, unknown>>(filter: T) =>
      ["punches-infinite", filter] as const,
    /** Facet filter metadata. */
    filters: <T extends Record<string, unknown>>(filter: T) => ["punch-filters", filter] as const,
    /** Entity schema (column metadata). Cached indefinitely. */
    schema: () => ["schema", "punch"] as const,
  },

  /** Reports */
  reports: {
    /** All report queries (invalidate with `QueryKeys.reports.all`). */
    all: ["reports"] as const,
    /** Report summary with date range filter. */
    summary: <T extends Record<string, unknown>>(filter: T) => ["report-summary", filter] as const,
  },

  /** API keys */
  apiKeys: {
    /** API key list. */
    list: () => ["api-keys"] as const,
  },

  /** Audit log */
  audit: {
    /** Audit log with filters. */
    list: <T extends Record<string, unknown>>(filter: T) => ["audit-logs", filter] as const,
    /** Entity schema (column metadata). Cached indefinitely. */
    schema: () => ["schema", "audit"] as const,
    /** Facet filter metadata. */
    filters: <T extends Record<string, unknown>>(filter: T) => ["audit-filters", filter] as const,
  },

  /** Integration endpoints */
  endpoints: {
    /** Integration endpoint list. */
    list: () => ["endpoints"] as const,
    /** Single integration endpoint by ID. */
    detail: (id: string) => ["endpoint", id] as const,
    /** Also used by settings page under a different key. */
    settings: () => ["integration-endpoints"] as const,
  },

  /** System settings */
  settings: {
    /** System-wide settings. */
    system: () => ["system-settings"] as const,
  },

  /** Health / status */
  health: {
    /** System health (engine + devices + distributors). */
    system: () => ["system-health"] as const,
  },

  /** Dashboard users */
  users: {
    /** User list. */
    list: () => ["users"] as const,
    /** Single user by ID. */
    detail: (id: string) => ["user", id] as const,
  },

  /** Employee directory */
  employees: {
    /** All employee queries (invalidate with `QueryKeys.employees.all`). */
    all: ["employees"] as const,
    /** Full employee list. */
    list: () => ["employees"] as const,
    /** Single employee by ID. */
    detail: (id: string) => ["employee", id] as const,
    /** Attendance summary for an employee by PIN. */
    summary: (pin: string) => ["employee-summary", pin] as const,
    /** Work days for an employee by PIN. */
    workDays: (pin: string) => ["employee-work-days", pin] as const,
    /** Monthly trend for an employee by PIN. */
    monthly: (pin: string) => ["employee-monthly", pin] as const,
    /** Calendar days for an employee by PIN. */
    calendar: (pin: string) => ["employee-calendar", pin] as const,
    /** Entity schema (column metadata). Cached indefinitely. */
    schema: () => ["schema", "employee"] as const,
    /** Facet filter metadata. */
    filters: <T extends Record<string, unknown>>(filter: T) => ["employee-filters", filter] as const,
  },

  /** Side panel entity detail */
  entityDetail: {
    /** Single entity detail. */
    detail: (entityType: string, entityId: string) =>
      ["entity-detail", entityType, entityId] as const,
  },

  /** Departments */
  departments: {
    /** All department queries (invalidate with `QueryKeys.departments.all`). */
    all: ["departments"] as const,
    /** Full department list. */
    list: () => ["departments"] as const,
    /** Single department by ID. */
    detail: (id: string) => ["department", id] as const,
    /** Entity schema (column metadata). Cached indefinitely. */
    schema: () => ["schema", "department"] as const,
    /** Facet filter metadata. */
    filters: <T extends Record<string, unknown>>(filter: T) => ["department-filters", filter] as const,
  },
} as const;
