import { useEffect } from "react";
import { useSetAtom } from "jotai";

import {
  isAuthenticatedSelector,
  currentUserState,
  authTokenState,
} from "@/infrastructure/state";
import { useStateValue } from "@/infrastructure/state/jotai";
import { fetchMe } from "@/lib/api";

/**
 * Loads the current user profile from `GET /api/auth/me` and populates
 * `currentUserState`.  Runs once on mount when the user is authenticated
 * and the profile has not yet been cached.
 *
 * On 401 the API client interceptor already dispatches `auth:logout`,
 * which clears the token.  We defensively clear the token here too
 * in case the error arrives through an unexpected code path.
 *
 * Place this hook near the root of the authenticated component tree
 * (e.g. inside `AuthProvider` or the top-level `App`).
 */
export function useCurrentUserLoader(): void {
  const isAuthenticated = useStateValue(isAuthenticatedSelector);
  const currentUser = useStateValue(currentUserState);
  const setCurrentUser = useSetAtom(currentUserState.atom);
  const setToken = useSetAtom(authTokenState.atom);

  useEffect(() => {
    if (!isAuthenticated || currentUser) return;

    let cancelled = false;

    fetchMe()
      .then((profile) => {
        if (!cancelled) setCurrentUser(profile);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401 → clear everything defensively
        if (err instanceof Error && err.message.includes("401")) {
          setToken(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentUser, setCurrentUser, setToken]);
}
