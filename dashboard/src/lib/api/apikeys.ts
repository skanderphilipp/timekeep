import { apiGet, apiPost, apiDelete } from "./client";

// ── Types ──────────────────────────────────────────────────────────────────

/** Matches the Rust `ApiKeyResponse` DTO. */
export type ApiKey = {
  id: string;
  name: string;
  /** First 16 characters of the key (for display identification). */
  prefix: string;
  /** Scoped permissions granted to this key. */
  permissions: string[];
  /** Who created this key. */
  created_by: string;
  /** Unix timestamp of creation. */
  created_at: number;
  /** Unix timestamp of last use (null = never used). */
  last_used_at: number | null;
  /** Unix timestamp of expiration (null = never expires). */
  expires_at: number | null;
  /** Whether this key has been revoked. */
  revoked: boolean;
};

/** Matches the Rust `CreateApiKeyRequest` DTO. */
export type CreateApiKeyRequest = {
  /** Human-readable name (e.g. "Odoo Production Integration"). */
  name: string;
  /** Space-separated permissions (e.g. "read:punches write:punches"). */
  permissions: string;
  /** Number of days until expiration. Omit for no expiration. */
  expires_in_days?: number;
};

/** Response returned ONCE when an API key is created — includes the raw key. */
export type ApiKeyCreatedResponse = ApiKey & {
  /** The full API key. Store it securely — it will not be shown again. */
  api_key: string;
};

// ── CRUD ───────────────────────────────────────────────────────────────────

/** List all API keys (metadata only). Requires Operator+. */
export function fetchApiKeys(): Promise<ApiKey[]> {
  return apiGet<ApiKey[]>("api-keys").json();
}

/** Create a new API key. Returns the raw key ONCE. Requires Admin. */
export function createApiKey(req: CreateApiKeyRequest): Promise<ApiKeyCreatedResponse> {
  return apiPost<ApiKeyCreatedResponse>("api-keys", req).json();
}

/** Revoke an API key (soft delete). Requires Admin. */
export function revokeApiKey(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`api-keys/${encodeURIComponent(id)}`).json();
}
