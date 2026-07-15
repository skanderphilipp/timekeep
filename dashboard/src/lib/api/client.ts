// ── Re-exports from the API client layer ────────────────────────────────────
//
// Domain files import these from ./client instead of reaching up
// to ../api-client directly.  This file is the single chokepoint
// between the HTTP layer and the domain API functions.

export {
  AUTH_LOGOUT_EVENT,
  setAuthToken,
  apiGet,
  apiGetWithMeta,
  apiPost,
  apiPut,
  apiDelete,
} from "../api-client";

// ── Shared pagination / facet types (used by multiple domains) ──────────────

/** Matches the Rust `PunchListResponse` wrapped in `ApiEnvelope`. */
export type PaginatedResponse<T> = {
  punches: T[];
};

/** Cursor-aware paginated response for infinite scroll. */
export type CursorPaginatedResponse<T> = {
  punches: T[];
  has_more: boolean;
  next_cursor?: string | null;
};

// ── Facet filter types (matches Rust FacetGroup / FacetOption) ───────────

/** How a facet dimension behaves in the UI. */
export type FacetKind = "enum" | "reference";

/** A single selectable value in a facet dimension. */
export type FacetOption = {
  value: string;
  label: string;
  count?: number | null;
};

/** One facet dimension with its available values. */
export type FacetGroup = {
  key: string;
  label: string;
  kind: FacetKind;
  options: FacetOption[];
  has_more: boolean;
  total?: number | null;
};

// ── Shared internal utilities ──────────────────────────────────────────────

/** Convert an ISO 8601 date string to a Unix timestamp (seconds). */
export function toUnixSeconds(iso: string): string {
  return String(Math.floor(new Date(iso).getTime() / 1000));
}

/** Shared auth header helper for raw fetch calls (export endpoint returns binary). */
export function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const raw = localStorage.getItem("ao-auth");
    if (raw) {
      const token: unknown = JSON.parse(raw);
      if (typeof token === "string" && token.length > 0) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // No token — request goes without auth header
  }
  return headers;
}
