import {
  apiGet,
  apiGetWithMeta,
  apiPost,
  toUnixSeconds,
  buildAuthHeaders,
} from "./client";
import type { PaginatedResponse, CursorPaginatedResponse, FacetGroup } from "./client";
import type { PunchStatusValue } from "@shared/punch-statuses";
import type { VerifyModeValue } from "@shared/verify-modes";
import type { EntitySchema } from "@/types/metadata";

// ── Types ──────────────────────────────────────────────────────────────────

/** Matches the Rust `PunchResponse` DTO. */
export type Punch = {
  id: string;
  user_pin: string;
  timestamp: number;
  status: PunchStatusValue;
  verify_mode: VerifyModeValue;
  device_sn: string;
  /** Human-readable device label (from configured devices). */
  device_label?: string | null;
  work_code?: string | null;
  employee_name?: string | null;
  /** Whether the attendance calculator flagged this punch as anomalous. */
  is_anomaly?: boolean;
  /** The anomaly type if flagged (e.g., "duplicate_check_in", "orphaned_check_out"). */
  anomaly_type?: string | null;
};

export type PunchFilter = {
  /** Multi-select device filter — sent comma-separated (OR logic). */
  device_sns?: string[];
  /** Multi-select user PIN filter — sent comma-separated (OR logic). */
  user_pins?: string[];
  /** Full-text search (searches user_pin, employee_name). */
  search?: string;
  since?: string;
  until?: string;
  /** Filter by punch status: check_in, check_out, break_out, break_in, overtime_in, overtime_out. */
  status?: string;
  /** Filter by verification method: fingerprint, face, card, password, palm. */
  verify_mode?: string;
  /** When "true", return only punches flagged as anomalous by the attendance calculator. */
  anomalies_only?: string;
  /** Sort column (e.g. "timestamp", "user_pin", "device_sn"). */
  sort_by?: string;
  /** Sort direction: "asc" or "desc". Backend reads `sort_order`, not `order_desc`. */
  sort_order?: "asc" | "desc";
  	/** @deprecated Use sort_order instead. Backend no longer reads this. */
  	order_desc?: boolean;
  	limit?: number;
  offset?: number;
  cursor?: string;
};

// ── Punch Queries ──────────────────────────────────────────────────────────

function buildPunchParams(filter: PunchFilter): string {
  const params = new URLSearchParams();
  if (filter.device_sns && filter.device_sns.length > 0) {
    params.set("device_sns", filter.device_sns.join(","));
  }
  if (filter.user_pins && filter.user_pins.length > 0) {
    params.set("user_pins", filter.user_pins.join(","));
  }
  if (filter.search) params.set("search", filter.search);
  if (filter.status) params.set("status", filter.status);
  if (filter.verify_mode) params.set("verify_mode", filter.verify_mode);
  	if (filter.anomalies_only) params.set("anomalies_only", "true");
  	if (filter.since) params.set("since", toUnixSeconds(filter.since));
  if (filter.until) params.set("until", toUnixSeconds(filter.until));
  if (filter.sort_by) params.set("sort_by", filter.sort_by);
  if (filter.sort_order) params.set("sort_order", filter.sort_order);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.cursor) params.set("cursor", filter.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchPunches(filter: PunchFilter = {}): Promise<PaginatedResponse<Punch>> {
  return apiGet<PaginatedResponse<Punch>>(`punches${buildPunchParams(filter)}`).json();
}

/** Fetch a single punch by its deduplication ID. Requires Viewer+. */
export function fetchPunch(id: string): Promise<Punch> {
  return apiGet<Punch>(`punches/${encodeURIComponent(id)}`).json();
}

/**
 * Fetch punches with cursor metadata for infinite scroll.
 *
 * Returns `{ punches, has_more, next_cursor }` so the consumer
 * can pass `next_cursor` as `cursor` in the next request.
 */
export function fetchPunchesCursor(
  filter: PunchFilter = {},
): Promise<CursorPaginatedResponse<Punch>> {
  return apiGetWithMeta<PaginatedResponse<Punch>>(`punches${buildPunchParams(filter)}`)
    .json()
    .then(({ data, meta }) => ({
      punches: data.punches,
      has_more: meta?.has_more ?? false,
      next_cursor: meta?.next_cursor ?? null,
    }));
}

// ── Facet Filters ──────────────────────────────────────────────────────────

/** Filter params for the facet metadata endpoint. */
export type FacetFilterParams = {
  dimension?: string;
  search?: string;
  limit?: number;
  /** Comma-separated device serial numbers (OR logic). */
  device_sns?: string[];
  /** Comma-separated user PINs (OR logic). */
  user_pins?: string[];
  since?: string;
  until?: string;
  status?: string;
  verify_mode?: string;
  anomalies_only?: string;
};

function buildFacetParams(filter: FacetFilterParams): string {
  const params = new URLSearchParams();
  if (filter.dimension) params.set("dimension", filter.dimension);
  if (filter.search) params.set("search", filter.search);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.device_sns && filter.device_sns.length > 0) {
    params.set("device_sns", filter.device_sns.join(","));
  }
  if (filter.user_pins && filter.user_pins.length > 0) {
    params.set("user_pins", filter.user_pins.join(","));
  }
  if (filter.since) params.set("since", toUnixSeconds(filter.since));
  if (filter.until) params.set("until", toUnixSeconds(filter.until));
  if (filter.status) params.set("status", filter.status);
  if (filter.verify_mode) params.set("verify_mode", filter.verify_mode);
  if (filter.anomalies_only) params.set("anomalies_only", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Fetch faceted filter metadata for punch queries.
 *
 * Returns available filter values (devices, statuses, employees, etc.)
 * with contextual punch counts that respect the current date range
 * and other active filters.
 */
export function fetchPunchFilters(filter: FacetFilterParams = {}): Promise<FacetGroup[]> {
  return apiGet<FacetGroup[]>(`punches/filters${buildFacetParams(filter)}`).json();
}

// ── Correction ─────────────────────────────────────────────────────────────

export type CorrectPunchRequest = {
  user_pin: string;
  device_sn: string;
  /** One of: check_in, check_out, break_out, break_in */
  status: string;
  /** Unix timestamp in seconds. Defaults to now if omitted. */
  timestamp?: number;
};

/** Matches the Rust `PunchCorrectedResponse` DTO. */
export type PunchCorrectedResponse = {
  id: string;
  user_pin: string;
  timestamp: number;
  status: string;
};

export function correctPunch(correction: CorrectPunchRequest): Promise<PunchCorrectedResponse> {
  return apiPost<PunchCorrectedResponse>("punches/correct", correction).json();
}

// ── Schema (Metadata System) ────────────────────────────────────────────────

/**
 * Fetch the entity schema for punches.
 *
 * Returns column metadata (field name, label, type, sortability, filterability)
 * that drives the table columns, sort controls, and filter bar.
 *
 * Cached indefinitely — schema is static per entity.
 */
export function fetchPunchSchema(): Promise<EntitySchema> {
  return apiGet<EntitySchema>("punches/schema").json();
}

// ── Export ─────────────────────────────────────────────────────────────────

export type ExportFilter = {
  /** Comma-separated device serial numbers (OR logic). */
  device_sns?: string[];
  /** Comma-separated user PINs (OR logic). */
  user_pins?: string[];
  since?: string;
  until?: string;
  limit?: number;
  sort_order?: "asc" | "desc";
  format?: "csv" | "xlsx";
};

function buildExportParams(f: ExportFilter): string {
  const params = new URLSearchParams();
  if (f.device_sns && f.device_sns.length > 0) params.set("device_sns", f.device_sns.join(","));
  if (f.user_pins && f.user_pins.length > 0) params.set("user_pins", f.user_pins.join(","));
  if (f.since) params.set("since", toUnixSeconds(f.since));
  if (f.until) params.set("until", toUnixSeconds(f.until));
  if (f.limit !== undefined) params.set("limit", String(f.limit));
  if (f.sort_order) params.set("sort_order", f.sort_order);
  if (f.format) params.set("format", f.format);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Download exported punches as a file (CSV or XLSX).
 *
 * Returns a Blob suitable for triggering a browser download.
 * Requires Admin.
 */
export async function fetchPunchExport(filter: ExportFilter = {}): Promise<Blob> {
  const url = `exports/punches${buildExportParams(filter)}`;
  const response = await fetch(`/api/${url}`, {
    headers: buildAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
  return response.blob();
}
