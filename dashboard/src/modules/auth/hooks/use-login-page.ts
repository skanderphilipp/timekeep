import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { isAuthenticatedSelector } from "@/infrastructure/state";
import { useStateValue } from "@/infrastructure/state/jotai";
import { fetchAbout } from "@/modules/auth/api/about";
import { QueryKeys } from "@/lib/query-keys";
import { ABOUT_STALE_TIME_MS } from "@/lib/constants";

/**
 * Login page orchestration hook.
 *
 * Exposes whether the user is already authenticated, the route to
 * redirect back to after login, and the workspace name for display.
 */
export function useLoginPage() {
  const location = useLocation();
  const isAuthenticated = useStateValue(isAuthenticatedSelector);

  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  const { data: about } = useQuery({
    queryKey: QueryKeys.auth.about(),
    queryFn: fetchAbout,
    staleTime: ABOUT_STALE_TIME_MS,
  });

  return { isAuthenticated, from, about };
}
