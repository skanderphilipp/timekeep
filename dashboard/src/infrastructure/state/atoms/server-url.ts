import { atom } from "jotai";
import { LS_SERVER_URL } from "@/lib/constants";

/**
 * Persisted server URL for the Tauri desktop app.
 *
 * When empty (first launch), the app shows a connection screen asking the
 * user to enter their server address (e.g. `http://192.168.1.100:3000`).
 * Once set, the API client is reconfigured to point at this URL and the
 * value survives app restarts via localStorage.
 *
 * In web/Docker mode, this atom stays empty and the default relative
 * `/api` path is used — no connection screen is shown.
 */

function readServerUrl(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(LS_SERVER_URL) ?? "";
}

function writeServerUrl(value: string): void {
  if (typeof localStorage === "undefined") return;
  if (value) {
    localStorage.setItem(LS_SERVER_URL, value);
  } else {
    localStorage.removeItem(LS_SERVER_URL);
  }
}

/** Raw server URL (e.g. `http://192.168.1.100:3000`) — no trailing slash. */
export const serverUrlState = atom(readServerUrl());

/** Write-only atom that persists the server URL and returns the full API base URL. */
export const setServerUrlAtom = atom(null, (_get, set, url: string) => {
  // Strip trailing slash for consistency
  const normalized = url.endsWith("/") ? url.slice(0, -1) : url;
  writeServerUrl(normalized);
  set(serverUrlState, normalized);
});

/** Derived: full API base URL (server URL + "/api"), or empty string if not set. */
export const apiBaseUrlAtom = atom((get) => {
  const server = get(serverUrlState);
  if (!server) return "";
  return `${server}/api`;
});
