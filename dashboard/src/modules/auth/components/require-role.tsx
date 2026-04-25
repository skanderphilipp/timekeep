import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAtomValue } from "jotai";

import { AppRoute } from "@/lib/navigation";
import { currentUserAtom } from "@/infrastructure/state";
import { roleSatisfies, type Role } from "@/infrastructure/navigation/roles";

type RequireRoleProps = {
  /** Minimum role required (viewer < operator < admin). */
  minimum: Role;
  children: ReactNode;
};

/**
 * Route guard: renders children only if the current user has at least
 * the specified role. Redirects unauthenticated users to `/login` and
 * renders nothing for users whose role is too low.
 *
 * Role hierarchy is delegated to `infrastructure/navigation/roles.ts`
 * (single source of truth, framework-agnostic).
 *
 * @example
 * ```tsx
 * <RequireRole minimum="admin">
 *   <ApiKeysPage />
 * </RequireRole>
 * ```
 */
export function RequireRole({ minimum, children }: RequireRoleProps) {
  const user = useAtomValue(currentUserAtom);

  if (!user) {
    return <Navigate to={AppRoute.login} replace />;
  }

  if (!roleSatisfies(user.role, minimum)) {
    return null;
  }

  return <>{children}</>;
}
