/**
 * Enterprise constants — every magic number and string lives here.
 *
 * Import: import { API_TIMEOUT_MS, DEFAULT_ZKTECO_PORT, ... } from "@/lib/constants";
 */

// ═══════════════════════════════════════════════════════════════════════
// API client
// ═══════════════════════════════════════════════════════════════════════

/** Base URL for the management API. Proxied by Vite in dev, served by Rust in prod. */
export const API_BASE = "/api";

/** Default request timeout in milliseconds. */
export const API_TIMEOUT_MS = 15_000;

/** Timeout for network scan requests — must accommodate scanning 254 hosts. */
export const API_SCAN_TIMEOUT_MS = 90_000;

/** Default number of retry attempts for idempotent requests. */
export const API_RETRY_COUNT = 2;

/** HTTP status codes that trigger an automatic retry. */
export const API_RETRY_STATUS_CODES = [408, 413, 429, 500, 502, 503, 504] as const;

/** HTTP methods eligible for automatic retry. */
export const API_RETRY_METHODS = ["get", "head"] as const;

// ═══════════════════════════════════════════════════════════════════════
// Pagination
// ═══════════════════════════════════════════════════════════════════════

/** Default page size for list endpoints. */
export const DEFAULT_PAGE_SIZE = 50;

/** Page size used for cursor-based pagination (infinite scroll). */
export const CURSOR_PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════════
// Polling & refresh intervals (milliseconds)
// ═══════════════════════════════════════════════════════════════════════

/** Polling interval for live data (e.g. dashboard summary). */
export const POLL_INTERVAL_MS = 30_000;

/** How long to consider cached dashboard data fresh. Alias for POLL_INTERVAL_MS. */
export const DASHBOARD_REFRESH_INTERVAL_MS = POLL_INTERVAL_MS;

/** Stale time for rarely-changing data (e.g. system settings). */
export const SETTINGS_STALE_TIME_MS = 60_000;

/** Stale time for infinite punch queries. */
export const PUNCHES_STALE_TIME_MS = 30_000;

// ═══════════════════════════════════════════════════════════════════════
// Device thresholds
// ═══════════════════════════════════════════════════════════════════════

/** Time in milliseconds after which a device is considered offline. */
export const DEVICE_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ═══════════════════════════════════════════════════════════════════════
// Network / device defaults
// ═══════════════════════════════════════════════════════════════════════

/** Default ZKTeco device port (all ZKTeco devices use this). */
export const DEFAULT_ZKTECO_PORT = 4370;

/** Minimum valid TCP port number. */
export const MIN_PORT = 1;

/** Maximum valid TCP port number. */
export const MAX_PORT = 65_535;

// ═══════════════════════════════════════════════════════════════════════
// Time constants (seconds)
// ═══════════════════════════════════════════════════════════════════════

/** One minute in seconds. */
export const SECONDS_PER_MINUTE = 60;

/** One hour in seconds. */
export const SECONDS_PER_HOUR = 3_600;

/** One day in seconds. */
export const SECONDS_PER_DAY = 86_400;

/** One week in seconds. */
export const SECONDS_PER_WEEK = 604_800;

// ═══════════════════════════════════════════════════════════════════════
// Branding
// ═══════════════════════════════════════════════════════════════════════

/** Application display name. */
export const APP_NAME = "TimeKeep";

/** Workspace / company name shown on the auth screen. */
export const WORKSPACE_NAME = "Alsabah";

// ═══════════════════════════════════════════════════════════════════════
// Local storage keys
// ═══════════════════════════════════════════════════════════════════════

export const LS_THEME = "ao-theme";
export const LS_LOCALE = "ao-locale";
export const LS_AUTH = "ao-auth";

// ═══════════════════════════════════════════════════════════════════════
// System settings defaults
// ═══════════════════════════════════════════════════════════════════════

/** Default poll interval in seconds (used before settings are loaded from API). */
export const DEFAULT_POLL_INTERVAL_SECS = 30;

// ═══════════════════════════════════════════════════════════════════════
// UI component sizing
// ═══════════════════════════════════════════════════════════════════════

/** Standard component size variants used across all UI primitives. */
export const COMPONENT_SIZES = ["sm", "md", "lg"] as const;
export type ComponentSize = (typeof COMPONENT_SIZES)[number];

/** Standard Tabler icon sizes in pixels. */
export const ICON_SIZE = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;
