import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";

import {
  type SidePanelEntry,
  pushSidePanelAtom,
  popSidePanelAtom,
  clearSidePanelStackAtom,
  replaceActiveEntityIdAtom,
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
  const replaceActiveEntityId = useSetAtom(replaceActiveEntityIdAtom);
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
    replaceActiveEntityId,
  };
}

/**
 * Unified hook for opening any record in the side panel — replaces
 * the previous split of `useOpenDetailPanel` (view) and
 * `useOpenEditPanel` (edit/create).
 *
 * Pattern: Twenty's `useOpenRecordInSidePanel`:
 *   twenty-front/src/modules/side-panel/hooks/useOpenRecordInSidePanel.ts
 *
 * @example
 * ```tsx
 * const openRecord = useOpenRecordInSidePanel();
 *
 * // View existing record
 * openRecord({ entityType: "device", entityId: sn, title: "Device K40" });
 *
 * // Create new record
 * openRecord({ entityType: "department", title: "Add Department", isNewRecord: true });
 * ```
 */
export function useOpenRecordInSidePanel() {
	const { pushEntry } = useSidePanelNavigation();

	return useCallback(
		(opts: {
			entityType: EntityType;
			entityId?: string;
			title: string;
			isNewRecord?: boolean;
		}) => {
			/**
			 * Twenty pattern: no separate "mode" — new records use empty entityId.
			 * The router derives isNewRecord = entityId.length === 0.
			 */
			const entityId = opts.isNewRecord ? "" : (opts.entityId ?? "");
			pushEntry({ entityType: opts.entityType, entityId, title: opts.title });
		},
		[pushEntry],
	);
}

/**
 * @deprecated Use {@link useOpenRecordInSidePanel} instead.
 *
 * Kept for backward compatibility during migration.
 *
 * @example (migration)
 * ```tsx
 * // Before:
 * openDetail("device", sn, `Device ${sn}`);
 * // After:
 * openRecord({ entityType: "device", entityId: sn, title: `Device ${sn}` });
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
