import { useEffect, type ReactNode } from "react";
import { useSetAtom } from "jotai";

import { authTokenState } from "@/infrastructure/state";
import { AUTH_LOGOUT_EVENT } from "@/lib/api";
import { useCurrentUserLoader } from "@/hooks/use-current-user";

type AuthProviderProps = {
  children: ReactNode;
};

/**
 * Bridges the API client's 401-handling with Jotai state.
 *
 * When the API client receives a 401, it clears localStorage and dispatches
 * `auth:logout`. This provider listens for that event and syncs the Jotai
 * atom, triggering a reactive logout across the entire component tree.
 *
 * Also loads the current user profile from `GET /api/auth/me` on mount.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const setToken = useSetAtom(authTokenState.atom);

  useEffect(() => {
    const handleLogout = () => {
      setToken(null);
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout);
  }, [setToken]);

  // Fetch user profile from the API when authenticated.
  useCurrentUserLoader();

  return <>{children}</>;
}
