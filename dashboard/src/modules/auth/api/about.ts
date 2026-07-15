/**
 * Public API endpoints consumed by the auth pages (no auth required).
 */
import { apiClient } from "@/lib/api-client";
import type { ApiEnvelope } from "@/lib/api-client";

export type AboutResponse = {
  name: string;
  version: string;
  support_email: string;
  workspace_name: string;
};

/**
 * Fetch public application info (name, version, workspace).
 * Used by the login page to display the workspace name.
 */
export async function fetchAbout(): Promise<AboutResponse> {
  const envelope = await apiClient().get("about").json<ApiEnvelope<AboutResponse>>();
  return envelope.data;
}
