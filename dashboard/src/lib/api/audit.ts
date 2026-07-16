import { apiGet, toUnixSeconds } from "./client";
import type { FacetGroup } from "./client";
import type { EntitySchema } from "@/types/metadata";

// ── Types ──────────────────────────────────────────────────────────────────

/** Matches the Rust `AuditEventResponse` DTO. */
export type AuditEvent = {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  detail?: Record<string, unknown> | null;
  ip_address?: string | null;
  status: string;
  error_message?: string | null;
};

export type AuditFilter = {
  actor?: string;
  action?: string;
  resource?: string;
  since?: string;
  until?: string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  limit?: number;
  cursor?: string;
};

function buildAuditParams(filter: AuditFilter): string {
  const params = new URLSearchParams();
  if (filter.actor) params.set("actor", filter.actor);
  if (filter.action) params.set("action", filter.action);
  if (filter.resource) params.set("resource", filter.resource);
  if (filter.since) params.set("since", toUnixSeconds(filter.since));
  if (filter.until) params.set("until", toUnixSeconds(filter.until));
  if (filter.search) params.set("search", filter.search);
  if (filter.sort_by) params.set("sort_by", filter.sort_by);
  if (filter.sort_order) params.set("sort_order", filter.sort_order);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.cursor) params.set("cursor", filter.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Query audit logs. Requires Viewer+. */
export function fetchAuditLogs(filter: AuditFilter = {}): Promise<AuditEvent[]> {
  return apiGet<AuditEvent[]>(`audit${buildAuditParams(filter)}`).json();
}

/** Fetch a single audit event by ID. Requires Viewer+. */
export function fetchAuditEvent(id: string): Promise<AuditEvent> {
  return apiGet<AuditEvent>(`audit/${encodeURIComponent(id)}`).json();
}

// ── Schema (Metadata System) ────────────────────────────────────────────────

/** Fetch entity schema for audit logs (column metadata, sortability, filterability). */
export function fetchAuditSchema(): Promise<EntitySchema> {
  return apiGet<EntitySchema>("audit/schema").json();
}

/**
 * Facet filter params for audit queries.
 *
 * Matches the Rust facet endpoint at GET /api/audit/filters.
 */
export type AuditFacetParams = {
  dimension?: string;
  search?: string;
  since?: string;
  until?: string;
  limit?: number;
};

function buildAuditFacetParams(filter: AuditFacetParams): string {
  const params = new URLSearchParams();
  if (filter.dimension) params.set("dimension", filter.dimension);
  if (filter.search) params.set("search", filter.search);
  if (filter.since) params.set("since", toUnixSeconds(filter.since));
  if (filter.until) params.set("until", toUnixSeconds(filter.until));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Fetch faceted filter metadata for audit queries. */
export function fetchAuditFilters(filter: AuditFacetParams = {}): Promise<FacetGroup[]> {
  return apiGet<FacetGroup[]>(`audit/filters${buildAuditFacetParams(filter)}`).json();
}
