import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { fetchSetupStatus } from "@/lib/api";

/**
 * Setup page orchestration hook.
 *
 * Checks whether first-run setup is needed; redirects to the login page
 * when the system is already configured.
 */
export function useSetupPage() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [needed, setNeeded] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    fetchSetupStatus()
      .then((s) => {
        if (s.setup_needed) {
          setNeeded(true);
        } else {
          navigate(AppRoute.login, { replace: true });
        }
      })
      .catch(() => setStatusError(_(msg`Cannot reach the server. Is it running?`)))
      .finally(() => setChecking(false));
  }, [_, navigate]);

  return { checking, needed, statusError };
}
