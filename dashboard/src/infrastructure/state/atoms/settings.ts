import { createState } from "@/infrastructure/state/jotai";
import type { IntegrationEndpoint, SystemSettings } from "@/lib/api";
import { DEFAULT_POLL_INTERVAL_SECS } from "@/lib/constants";

/**
 * Integration endpoints + system settings state via Jotai atoms.
 *
 * - `endpointsState` — holds the list of configured integration endpoints.
 * - `systemSettingsState` — holds system-wide settings (polling, etc.).
 *   Initialized with sensible defaults; populated from API on first load.
 * - `settingsLoadedState` — whether data has been fetched at least once.
 *
 * All data is persisted server-side in the database.
 */

/** Configured integration endpoints (webhook, Odoo, SAP, Zapier, ...). */
export const endpointsState = createState<IntegrationEndpoint[]>({
  key: "endpoints",
  defaultValue: [],
});

/** System-wide settings (poll interval, auto-discover). */
export const systemSettingsState = createState<SystemSettings>({
  key: "systemSettings",
  defaultValue: {
    poll_interval_secs: DEFAULT_POLL_INTERVAL_SECS,
    auto_discover: false,
  },
});

/** Whether settings have been loaded from the API at least once. */
export const settingsLoadedState = createState<boolean>({
  key: "settingsLoaded",
  defaultValue: false,
});


