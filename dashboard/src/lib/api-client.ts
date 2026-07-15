import ky, { type KyInstance, HTTPError } from "ky";
import {
  API_BASE,
  API_TIMEOUT_MS,
  API_RETRY_COUNT,
  API_RETRY_STATUS_CODES,
  API_RETRY_METHODS,
  LS_AUTH,
} from "./constants";

export { HTTPError };

/** Custom event dispatched when the API client receives a 401. */
export const AUTH_LOGOUT_EVENT = "auth:logout";

// ── Module-level token cache ─────────────────────────────────────────
//
// Jotai's atomWithStorage writes to localStorage asynchronously
// (React batches state updates). Components that read the token
// via localStorage.getItem() may see stale null between the
// atom write and the next microtask.
//
// This cache bridges the gap: setAuthToken() writes synchronously
// to both localStorage and this variable.  defaultGetToken() checks
// the cache first, falling back to localStorage.

let _cachedToken: string | null = null;

/**
 * Store a new auth token.  Call this IMMEDIATELY after login
 * succeeds — before navigating to the dashboard.  This guarantees
 * that the first API request from the dashboard carries the token.
 */
export function setAuthToken(token: string): void {
  _cachedToken = token;
  if (typeof localStorage !== "undefined") {
    // Mirror the Jotai atomWithStorage format: JSON-encoded string
    localStorage.setItem(LS_AUTH, JSON.stringify(token));
  }
}

/** Clear the cached token (called on logout or 401). */
export function clearAuthToken(): void {
  _cachedToken = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(LS_AUTH);
  }
}

export type ApiClientOptions = {
  baseUrl?: string;
  timeout?: number | false;
  retries?: number;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
};

/**
 * Standard API envelope as returned by the Rust backend (`response.rs`).
 *
 * Every endpoint returns `ApiEnvelope<T>`:
 * ```json
 * { "data": { ... }, "meta": null, "error": null }
 * ```
 *
 * On error: `data` is `null`, `error` carries `{ code, message }`.
 */
export type ApiEnvelope<T> = {
  data: T;
  meta?: PageMeta | null;
  error?: ApiErrorBody | null;
};

/** Machine-readable error returned inside the envelope. */
export type ApiErrorBody = {
  code: string;
  message: string;
  fields?: { field: string; message: string }[];
};

/** Pagination metadata attached to list endpoints. */
export type PageMeta = {
  has_more: boolean;
  next_cursor?: string | null;
  total?: number | null;
};

export function createApiClient(options: ApiClientOptions = {}): KyInstance {
  const {
    baseUrl = API_BASE,
    timeout = API_TIMEOUT_MS,
    retries = API_RETRY_COUNT,
    getToken = defaultGetToken,
    onUnauthorized = defaultOnUnauthorized,
  } = options;

  return ky.create({
    prefix: baseUrl,
    timeout,
    retry: {
      limit: retries,
      methods: [...API_RETRY_METHODS],
      statusCodes: [...API_RETRY_STATUS_CODES],
    },
    hooks: {
      beforeRequest: [
        (state) => {
          const token = getToken();
          if (token) {
            state.request.headers.set("Authorization", `Bearer ${token}`);
          }
        },
      ],
      afterResponse: [
        (state) => {
          if (state.response.status === 401) {
            onUnauthorized();
          }
        },
      ],
    },
  });
}

/**
 * Read the current JWT.  Checks the module-level cache first (set
 * synchronously by `setAuthToken`), then falls back to localStorage
 * for tokens that survived a page refresh.
 */
function defaultGetToken(): string | null {
  if (_cachedToken) return _cachedToken;
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(LS_AUTH);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      _cachedToken = parsed; // hydrate cache from localStorage on page load
      return parsed;
    }
    return null;
  } catch {
    return raw;
  }
}

function defaultOnUnauthorized(): void {
  clearAuthToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  }
}

let _client: KyInstance = createApiClient();

export function setApiClient(client: KyInstance): void {
  _client = client;
}

export function apiClient(): KyInstance {
  return _client;
}

// ── Envelope-aware JSON helpers ────────────────────────────────────────────

/**
 * Fetch JSON from the API and unwrap the `data` field from the standard
 * `ApiEnvelope<T>` response envelope.
 */
export function apiGet<T>(path: string): { json: () => Promise<T> } {
  return {
    json: async () => {
      const envelope = await _client.get(path).json<ApiEnvelope<T>>();
      return envelope.data;
    },
  };
}

/**
 * Fetch JSON with pagination metadata preserved.
 *
 * Returns both the data payload AND the page meta (has_more, next_cursor, total).
 * Use this for cursor-based pagination / infinite scroll endpoints.
 */
export function apiGetWithMeta<T>(path: string): {
  json: () => Promise<{ data: T; meta?: PageMeta | null }>;
} {
  return {
    json: async () => {
      const envelope = await _client.get(path).json<ApiEnvelope<T>>();
      return { data: envelope.data, meta: envelope.meta };
    },
  };
}

/**
 * POST JSON to the API and unwrap the `data` field from the response envelope.
 */
export function apiPost<T>(path: string, body: unknown, opts?: { timeout?: number | false }): { json: () => Promise<T> } {
  return {
    json: async () => {
      const envelope = await _client
        .post(path, { json: body, ...(opts?.timeout !== undefined ? { timeout: opts.timeout } : {}) })
        .json<ApiEnvelope<T>>();
      return envelope.data;
    },
  };
}

/**
 * PUT JSON to the API and unwrap the `data` field from the response envelope.
 */
export function apiPut<T>(path: string, body: unknown): { json: () => Promise<T> } {
  return {
    json: async () => {
      const envelope = await _client.put(path, { json: body }).json<ApiEnvelope<T>>();
      return envelope.data;
    },
  };
}

/**
 * DELETE request to the API and unwrap the `data` field from the response envelope.
 */
export function apiDelete<T>(path: string): { json: () => Promise<T> } {
  return {
    json: async () => {
      const envelope = await _client.delete(path).json<ApiEnvelope<T>>();
      return envelope.data;
    },
  };
}
