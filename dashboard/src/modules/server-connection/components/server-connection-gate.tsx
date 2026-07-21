import { type ReactNode, useEffect } from "react";
import { useAtomValue } from "jotai";
import { serverUrlState } from "@/infrastructure/state";
import { createApiClient, setApiClient } from "@/lib/api-client";
import { isTauri } from "@/lib/is-tauri";

type ServerConnectionGateProps = {
  children: ReactNode;
};

/**
 * Guards the app behind a server-connection check.
 *
 * In the Tauri desktop app, the user must configure a server URL before
 * the app can make API calls. If no URL is saved, the user is redirected
 * to the connection page.
 *
 * In the web/Docker version, the API is served from the same origin,
 * so this gate is a no-op — it renders children immediately.
 *
 * When a saved server URL is found (e.g. from a previous session), the
 * API client is reconfigured to use it automatically on mount.
 */
export function ServerConnectionGate({ children }: ServerConnectionGateProps) {
  const serverUrl = useAtomValue(serverUrlState);

  useEffect(() => {
    if (serverUrl) {
      const apiUrl = serverUrl.endsWith("/")
        ? `${serverUrl}api`
        : `${serverUrl}/api`;
      setApiClient(createApiClient({ baseUrl: apiUrl }));
    }
  }, [serverUrl]);

  // In web mode, always render children (API is same-origin)
  if (!isTauri()) {
    return <>{children}</>;
  }

  // In Tauri mode, if no server URL is configured, redirect to connection page
  if (!serverUrl) {
    // Use a full page reload to /connect — avoids router complications
    if (window.location.pathname !== "/connect") {
      window.location.replace("/connect");
      return null;
    }
  }

  return <>{children}</>;
}
