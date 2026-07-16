import { useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";

import { isAuthenticatedSelector, clientConfigState } from "@/infrastructure/state";
import { WORKSPACE_NAME } from "@/lib/constants";

/**
 * Login page orchestration hook.
 *
 * Reads the client bootstrap config from the Jotai `clientConfigState`
 * atom (populated by `ClientConfigHydrator` on mount) instead of making
 * a separate `GET /api/about` call. This reduces round-trips and ensures
 * the login page shares the same workspace branding as the rest of the app.
 */
export function useLoginPage() {
  const location = useLocation();
  const isAuthenticated = useAtomValue(isAuthenticatedSelector.atom);
  const clientConfig = useAtomValue(clientConfigState.atom);

  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  const workspace = clientConfig?.workspace_name || WORKSPACE_NAME;

  return { isAuthenticated, from, workspace };
}
