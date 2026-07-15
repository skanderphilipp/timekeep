import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import { INTEGRATION_KINDS, type IntegrationKindValue } from "@shared/integration-kinds";

// ── Re-exports ─────────────────────────────────────────────────────────────

export { INTEGRATION_KINDS };
export type IntegrationKind = IntegrationKindValue;

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Lingui translation function signature (accepts MessageDescriptor objects).
 * Shared with `permissions.ts` — keep in sync.
 */
type T = (descriptor: { id: string; message: string }) => string;

/**
 * Create translated integration kinds for React components.
 *
 * Use in React components via `useLingui()`:
 *   const { _ } = useLingui();
 *   const kinds = createIntegrationKinds(_);
 *
 * Non-React contexts should import {@link INTEGRATION_KINDS} directly
 * (English defaults).
 */
export function createIntegrationKinds(_: T) {
  return INTEGRATION_KINDS.map((k) => ({
    ...k,
    label: _({ id: k.value, message: k.label }),
  }));
}

/** Matches the Rust `IntegrationEndpoint` / `EndpointResponse` DTO. */
export type IntegrationEndpoint = {
  id: string;
  name: string;
  /** Integration kind — matches shared catalog. */
  kind: IntegrationKindValue;
  enabled: boolean;
  /** Type-specific JSON config object. */
  config: Record<string, unknown>;
  created_at: number;
  updated_at: number;
};

/** Matches the Rust `CreateEndpointRequest` DTO. */
export type CreateEndpointRequest = {
  name: string;
  kind: IntegrationKindValue;
  config?: Record<string, unknown>;
};

/** Matches the Rust `UpdateEndpointRequest` DTO. */
export type UpdateEndpointRequest = {
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

// ── CRUD ───────────────────────────────────────────────────────────────────

/** Fetch all integration endpoints. Requires Viewer+. */
export function fetchEndpoints(): Promise<IntegrationEndpoint[]> {
  return apiGet<IntegrationEndpoint[]>("endpoints").json();
}

/** Fetch a single integration endpoint by ID. Requires Viewer+. */
export function fetchEndpoint(id: string): Promise<IntegrationEndpoint> {
  return apiGet<IntegrationEndpoint>(`endpoints/${encodeURIComponent(id)}`).json();
}

/** Create a new integration endpoint. Requires Admin. */
export function createEndpoint(req: CreateEndpointRequest): Promise<IntegrationEndpoint> {
  return apiPost<IntegrationEndpoint>("endpoints", req).json();
}

/** Update an integration endpoint. Requires Admin. */
export function updateEndpoint(
  id: string,
  req: UpdateEndpointRequest,
): Promise<IntegrationEndpoint> {
  return apiPut<IntegrationEndpoint>(`endpoints/${encodeURIComponent(id)}`, req).json();
}

/** Delete an integration endpoint. Requires Admin. */
export function deleteEndpoint(id: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`endpoints/${encodeURIComponent(id)}`).json();
}
