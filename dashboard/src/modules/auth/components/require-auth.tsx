import { Navigate, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";

import { AppRoute } from "@/lib/navigation";
import { isAuthenticatedAtom } from "@/infrastructure/state";

type RequireAuthProps = {
  children: React.ReactNode;
};

/**
 * Route guard: redirects unauthenticated users to the login page.
 *
 * Preserves the intended destination in `location.state.from` so the
 * login page can redirect back after successful authentication.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={AppRoute.login} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
