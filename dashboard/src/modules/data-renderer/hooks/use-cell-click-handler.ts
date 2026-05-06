import { useCallback, useMemo, useRef } from "react";

import type { EntityType } from "../types";
import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

/** Counter for generating unique table instance IDs. */
let tableInstanceCounter = 0;

/**
 * Hook: cell click handler with entity routing.
 *
 * Maps each entity type to the correct detail panel:
 * - device → opens device detail
 * - user → opens user detail
 * - punch → opens the punch's device detail (row click)
 * - api_key / audit → opens respective detail (to be implemented)
 */
export function useCellClickHandler() {
  const openDetail = useOpenDetailPanel();
  const { _ } = useLingui();

  return useCallback(
    (entityType: EntityType, entityId: string, title?: string) => {
      switch (entityType) {
        case "device":
          openDetail("device", entityId, title ?? _(msg`Device ${entityId}`));
          break;
        case "user":
          openDetail("user", entityId, title ?? _(msg`User ${entityId}`));
          break;
        // Row click on punch table → opens device (the punch's device)
        case "punch":
          openDetail("punch", entityId, title ?? _(msg`Punch ${entityId}`));
          break;
        case "api_key":
          openDetail("api_key", entityId, title ?? _(msg`API Key ${entityId}`));
          break;
        case "audit":
          openDetail("audit", entityId, title ?? _(msg`Audit Event ${entityId}`));
          break;
      }
    },
    [openDetail, _],
  );
}

/**
 * Generates a unique table instance ID.
 *
 * Each table instance must have its own ID to scope Jotai atoms
 * via `atomFamily`. This prevents cross-table state leaks.
 *
 * Uses a module-level counter + useRef for stable IDs across renders.
 */
export function useTableInstanceId(): string {
  const idRef = useRef<string>("");
  return useMemo(() => {
    if (!idRef.current) {
      idRef.current = `table-${++tableInstanceCounter}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return idRef.current;
  }, []);
}
