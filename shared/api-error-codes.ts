/**
 * API error codes — standardized error responses from the backend.
 *
 * Mirrors `ApiError` code strings in `crates/timekeep-api/src/response.rs`.
 * Each code maps to an HTTP status code. The frontend uses this for
 * typed error handling and user-facing error messages.
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical API error code strings. */
export type ApiErrorCode =
  | "not_found"
  | "validation_error"
  | "duplicate"
  | "unauthorized"
  | "forbidden"
  | "internal_error"
  | "auth_error";

/** An API error code definition. */
export type ApiErrorDef = {
  /** Error code string from the API envelope. */
  code: ApiErrorCode;
  /** Corresponding HTTP status code. */
  httpStatus: number;
  /** Human-readable description for developers. */
  description: string;
};

/**
 * All API error codes returned by the backend.
 */
export const API_ERROR_CODES = [
  { code: "not_found",         httpStatus: 404, description: "The requested resource does not exist." },
  { code: "validation_error",  httpStatus: 422, description: "The request payload failed validation." },
  { code: "duplicate",         httpStatus: 409, description: "A resource with the same unique key already exists." },
  { code: "unauthorized",      httpStatus: 401, description: "Authentication is required." },
  { code: "forbidden",         httpStatus: 403, description: "The authenticated user lacks permission." },
  { code: "internal_error",    httpStatus: 500, description: "An unexpected server error occurred." },
  { code: "auth_error",        httpStatus: 422, description: "Authentication failed (bad credentials)." },
] as const satisfies readonly ApiErrorDef[];

/** Error code → definition lookup. */
export const API_ERROR_MAP = new Map<ApiErrorCode, ApiErrorDef>(
  API_ERROR_CODES.map((e) => [e.code, e]),
);

/** Get an error code definition by its code string. */
export function getApiError(code: string): ApiErrorDef | undefined {
  return API_ERROR_MAP.get(code as ApiErrorCode);
}

/** Check if an error code indicates an authentication problem. */
export function isAuthError(code: string): boolean {
  return code === "unauthorized" || code === "auth_error" || code === "forbidden";
}
