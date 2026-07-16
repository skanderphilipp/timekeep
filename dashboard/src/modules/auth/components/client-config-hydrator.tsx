import { useEffect } from "react";
import { useSetAtom } from "jotai";

import { clientConfigState } from "@/infrastructure/state";
import { fetchClientConfig } from "@/lib/api/client-config";

/**
 * Fetches `GET /api/client-config` on mount and stores the result in
 * the Jotai `clientConfigState` atom. Runs once at app startup.
 *
 * Similar to `MetadataHydrator`, but for bootstrap configuration
 * rather than entity schemas. Must be rendered inside `<JotaiProvider>`.
 */
export function ClientConfigHydrator() {
  const setConfig = useSetAtom(clientConfigState.atom);

  useEffect(() => {
    let cancelled = false;

    fetchClientConfig()
      .then((config) => {
        if (!cancelled) setConfig(config);
      })
      .catch(() => {
        // Server unreachable — the login/setup pages handle this
        // gracefully by showing connection errors to the user.
      });

    return () => {
      cancelled = true;
    };
  }, [setConfig]);

  return null;
}
