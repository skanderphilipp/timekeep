/**
 * JWT utility — decode the token payload client-side.
 *
 * The Rust backend issues tokens with Claims { sub, role, permissions, exp, iat }.
 * We decode the base64 payload without verifying the signature — signature
 * verification is server-side only (the API returns 401 for invalid tokens).
 */

export { roleSatisfies, type Role } from "@shared/roles";

/** Claims embedded in the JWT by the Rust backend. */
export type JwtClaims = {
  /** Username (the `sub` claim). */
  sub: string;
  /** Role from the shared catalog. */
  role: import("@shared/roles").Role;
  /** Space-separated permission scopes (e.g. "read:devices write:punches"). */
  permissions: string;
  /** Expiration timestamp (Unix seconds). */
  exp: number;
  /** Issued-at timestamp (Unix seconds). */
  iat: number;
};

/**
 * Decode the JWT payload without signature verification.
 *
 * Returns `null` if the token is missing, malformed, or expired.
 */
export function decodeToken(token: string | null): JwtClaims | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // The payload is the second part (header.payload.signature)
    const payload = parts[1];
    // Standard base64url → base64 conversion
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64)) as JwtClaims;

    // Check expiration
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
