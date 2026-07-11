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
  },

  /** Integration endpoints */
  endpoints: {
    /** Integration endpoint list. */
    list: () => ["endpoints"] as const,
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
  },

  /** Side panel entity detail */
  entityDetail: {
    /** Single entity detail. */
    detail: (entityType: string, entityId: string) =>
      ["entity-detail", entityType, entityId] as const,
  },
} as const;
