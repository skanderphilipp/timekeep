import { atom } from "jotai";
import type { IntegrationEndpoint, SystemSettings } from "@/lib/api";
import { DEFAULT_POLL_INTERVAL_SECS } from "@/lib/constants";

/**
 * Integration endpoints + system settings state via Jotai atoms.
 *
 * - `endpointsAtom` — holds the list of configured integration endpoints.
 * - `systemSettingsAtom` — holds system-wide settings (polling, etc.).
 *   Initialized with sensible defaults; populated from API on first load.
 * - `settingsLoadedAtom` — whether data has been fetched at least once.
 *
 * All data is persisted server-side in the database.
 */

/** Configured integration endpoints (webhook, Odoo, SAP, Zapier, ...). */
export const endpointsAtom = atom<IntegrationEndpoint[]>([]);

/** System-wide settings (poll interval, auto-discover). */
export const systemSettingsAtom = atom<SystemSettings>({
  poll_interval_secs: DEFAULT_POLL_INTERVAL_SECS,
  auto_discover: false,
});

/** Whether settings have been loaded from the API at least once. */
export const settingsLoadedAtom = atom<boolean>(false);
