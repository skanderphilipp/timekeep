import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useAtomValue } from "jotai";

import { AppRoute } from "@/lib/navigation";
import { clientConfigState } from "@/infrastructure/state";
import { fetchClientConfig } from "@/lib/api/client-config";

/**
 * Setup page orchestration hook.
 *
 * Reads the `clientConfigState` Jotai atom (populated by `ClientConfigHydrator`)
 * and redirects to the login page when the system is already configured.
 *
 * Falls back to a direct fetch if the atom hasn't been populated yet
 * (e.g. during a direct deep-link to `/setup` before the hydrator resolves).
 */
export function useSetupPage() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  const clientConfig = useAtomValue(clientConfigState.atom);

  const [checking, setChecking] = useState(!clientConfig);
  const [needed, setNeeded] = useState(clientConfig?.setup_needed ?? false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    // Atom already populated → use it synchronously
    if (clientConfig) {
      setChecking(false);
      if (!clientConfig.setup_needed) {
        navigate(AppRoute.login, { replace: true });
      } else {
        setNeeded(true);
      }
      return;
    }

    // Fallback: direct fetch if atom hasn't loaded yet
    let cancelled = false;
    fetchClientConfig()
      .then((config) => {
        if (cancelled) return;
        if (!config.setup_needed) {
          navigate(AppRoute.login, { replace: true });
        } else {
          setNeeded(true);
        }
      })
      .catch(() => setStatusError(_(msg`Cannot reach the server. Is it running?`)))
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [_, navigate, clientConfig]);

  return { checking, needed, statusError };
}
