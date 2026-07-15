/**
 * Role badge — thin wrapper around the shared `<Badge>` component.
 *
 * Maps the current user's role to a Badge variant and renders it.
 * No custom styles — all visual primitives come from `components/ui/badge/`.
 */

import { useAtomValue } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { currentUserRoleAtom } from "@/infrastructure/state";
import { Badge } from "@/components/ui/badge";

/** Maps a role string to its human-readable i18n label. */
function useRoleLabel(role: string): string {
  const { _ } = useLingui();
  switch (role) {
    case "admin":
      return _(msg`Admin`);
    case "operator":
      return _(msg`Operator`);
    case "viewer":
      return _(msg`Viewer`);
    default:
      return role;
  }
}

/** Maps a role string to the Badge variant used for display. */
function roleToVariant(role: string | null): "info" | "warning" | "neutral" {
  switch (role) {
    case "admin":
      return "info";
    case "operator":
      return "warning";
    default:
      return "neutral";
  }
}

export function RoleBadge() {
  const role = useAtomValue(currentUserRoleAtom);
  const label = useRoleLabel(role ?? "");

  if (!role) return null;

  return (
    <Badge variant={roleToVariant(role)} size="sm">
      {label}
    </Badge>
  );
}
