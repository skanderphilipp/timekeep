import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";

import {
  type SidePanelEntry,
  pushSidePanelAtom,
  popSidePanelAtom,
  clearSidePanelStackAtom,
  sidePanelStackAtom,
  sidePanelActiveEntryAtom,
} from "../side-panel-navigation-stack";
import type { EntityType } from "@/types/entities";

/**
 * Hook for side panel navigation (push/pop/back).
 *
 * Provides push/pop operations and the current stack state.
 */
export function useSidePanelNavigation() {
  const push = useSetAtom(pushSidePanelAtom);
  const pop = useSetAtom(popSidePanelAtom);
  const clear = useSetAtom(clearSidePanelStackAtom);
  const stack = useAtomValue(sidePanelStackAtom);
  const activeEntry = useAtomValue(sidePanelActiveEntryAtom);

  const pushEntry = useCallback(
    (entry: Omit<SidePanelEntry, "instanceId">) => {
      push({
        ...entry,
        instanceId: `side-panel-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
      });
    },
    [push],
  );

  const goBack = useCallback(() => pop(), [pop]);
  const close = useCallback(() => clear(), [clear]);

  const canGoBack = stack.length > 1;
  const isOpen = stack.length > 0;

  return {
    stack,
    activeEntry,
    isOpen,
    canGoBack,
    pushEntry,
    goBack,
    close,
  };
}

/**
 * Hook that opens a detail panel for any entity type.
 *
 * Used by cell click handlers to route to the correct detail view.
 *
 * @example
 * ```tsx
 * const openDetail = useOpenDetailPanel();
 * // Click device SN → open device detail
 * openDetail("device", punch.device_sn, `Device ${punch.device_sn}`);
 * // Click user PIN → open user detail
 * openDetail("user", punch.user_pin, `User ${punch.user_pin}`);
 * ```
 */
export function useOpenDetailPanel() {
  const { pushEntry } = useSidePanelNavigation();

  return useCallback(
    (entityType: EntityType, entityId: string, title?: string) => {
      const displayTitle = title ?? `${entityType} ${entityId}`;
      pushEntry({ entityType, entityId, title: displayTitle });
    },
    [pushEntry],
  );
}
