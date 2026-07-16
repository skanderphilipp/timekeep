/**
 * Bootstrap / client-config API — fetches workspace branding, version,
 * setup status, and (future) feature flags in a single public request.
 *
 * Used by `main.tsx` during app bootstrap and stored in a Jotai atom
 * so every component (login page, setup page, sidebar) shares the
 * same data without additional round-trips.
 */
import { apiClient } from "@/lib/api-client";
import type { ApiEnvelope } from "@/lib/api-client";

export type ClientConfig = {
  /** Application name (e.g. "timekeep"). */
  name: string;
  /** Build version (e.g. "0.1.0"). */
  version: string;
  /** Workspace / company name as configured in system settings. */
  workspace_name: string;
  /** Support email as configured in system settings. */
  support_email: string;
  /** Whether first-run setup (creating the initial admin) is needed. */
  setup_needed: boolean;
};

/**
 * Fetch the client bootstrap configuration from `GET /api/client-config`.
 *
 * No authentication required — this is the very first API call the
 * frontend makes, before any user logs in.
 */
export async function fetchClientConfig(): Promise<ClientConfig> {
  const envelope = await apiClient()
    .get("client-config")
    .json<ApiEnvelope<ClientConfig>>();
  return envelope.data;
}
