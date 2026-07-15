import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { AppRoute } from "@/lib/navigation";
import { isAuthenticatedSelector } from "@/infrastructure/state";
import { useStateValue } from "@/infrastructure/state/jotai";
import { fetchSetupStatus } from "@/lib/api";

type RequireAuthProps = {
  children: React.ReactNode;
};

/**
 * Route guard: redirects unauthenticated users to the login page.
 *
 * Before redirecting, checks whether first-run setup is needed.
 * If no admin user exists, redirects to /setup instead of /login.
 *
 * Preserves the intended destination in `location.state.from` so the
 * login page can redirect back after successful authentication.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useStateValue(isAuthenticatedSelector);
  const location = useLocation();

  const [checking, setChecking] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setChecking(false);
      return;
    }
    fetchSetupStatus()
      .then((s) => {
        if (s.setup_needed) setSetupNeeded(true);
      })
      .catch(() => {
        /* API unreachable — fall through to login */
      })
      .finally(() => setChecking(false));
  }, [isAuthenticated]);

  if (checking) return null;

  if (setupNeeded) {
    return <Navigate to={AppRoute.setup} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to={AppRoute.login} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
