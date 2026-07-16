import { useCallback, useMemo, useRef } from "react";

import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import type { EntityType } from "@/types/entities";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

/** Counter for generating unique table instance IDs. */
let tableInstanceCounter = 0;

/**
 * Hook: generic cell click handler.
 *
 * Opens the detail panel for any entity type. No per-entity switch —
 * the caller provides the entity type from column metadata.
 */
export function useCellClickHandler() {
  const openDetail = useOpenDetailPanel();
  const { _ } = useLingui();

  return useCallback(
    (entityType: string, entityId: string, title?: string) => {
      openDetail(entityType as EntityType, entityId, title ?? _(msg`${entityType} ${entityId}`));
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
  // oxlint-disable-next-line bentech/no-state-useref -- stable ID, never affects rendering
  const idRef = useRef<string>("");
  return useMemo(() => {
    if (!idRef.current) {
      idRef.current = `table-${++tableInstanceCounter}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return idRef.current;
  }, []);
}
