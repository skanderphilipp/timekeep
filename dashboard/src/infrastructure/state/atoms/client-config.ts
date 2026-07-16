import { createState } from "@/infrastructure/state/jotai";
import type { ClientConfig } from "@/lib/api/client-config";

/**
 * Client bootstrap configuration — fetched once at app startup from
 * `GET /api/client-config` and shared across all components.
 *
 * Holds workspace branding, version, setup status, and (future)
 * feature flags. Used by the login page, setup page, sidebar
 * workspace name display, and error/footer components.
 *
 * Because this is NOT persisted to localStorage (the server is the
 * source of truth), it resets on every full page load. The
 * `ClientConfigHydrator` component in `main.tsx` populates it
 * during bootstrap.
 */
export const clientConfigState = createState<ClientConfig | null>({
  key: "clientConfig",
  defaultValue: null,
});
