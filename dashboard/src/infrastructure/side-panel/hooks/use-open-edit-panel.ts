import { useCallback } from "react";

import { useSidePanelNavigation } from "./use-side-panel-navigation";
import type { EntityType } from "@/types/entities";

/**
 * Hook that opens the side panel for editing or creating an entity.
 *
 * Analog to `useOpenDetailPanel` but for edit/create forms instead of
 * read-only detail views. Pushes a SidePanelEntry with the appropriate
 * mode so the router renders a form instead of a detail view.
 *
 * Twenty reference:
 *   `twenty-front/src/modules/side-panel/hooks/useNavigateSidePanel.ts`
 *
 * @example
 * ```tsx
 * const openEdit = useOpenEditPanel();
 *
 * // Edit existing department
 * openEdit("department", deptId, "Edit Engineering");
 *
 * // Create new department
 * openEdit("department", "", "Add Department", "create");
 * ```
 */
export function useOpenEditPanel() {
  const { pushEntry } = useSidePanelNavigation();

  return useCallback(
    (
      entityType: EntityType,
      entityId: string,
      title: string,
      mode: "edit" | "create" = "edit",
    ) => {
      pushEntry({ entityType, entityId, title, mode });
    },
    [pushEntry],
  );
}
