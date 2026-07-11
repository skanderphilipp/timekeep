import { useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";

import { isAuthenticatedAtom } from "@/infrastructure/state";

/**
 * Login page orchestration hook.
 *
 * Exposes whether the user is already authenticated and the route to
 * redirect back to after login (captured by the auth guard).
 */
export function useLoginPage() {
  const location = useLocation();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  return { isAuthenticated, from };
}
