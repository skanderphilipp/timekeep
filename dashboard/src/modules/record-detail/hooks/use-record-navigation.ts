import { useCallback } from "react";
import type { EntityType } from "@/types/entities";
import { AppRoute } from "@/lib/navigation";
import { useRecordDetailContext } from "../states/record-detail-context";
import { useOpenDetailPanel, useOpenRecordInSidePanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useNavigate } from "react-router-dom";

/**
 * Navigation helpers for detail views.
 *
 * Automatically chooses between full-page navigation (main panel)
 * and side-panel-based navigation based on context.
 *
 * Pattern: twenty doesn't have a direct equivalent — their navigation
 * is built into the command menu and side panel system. We adapt the
 * same principle: the component shouldn't know where it's rendered.
 */
export function useRecordNavigation() {
  const { isInSidePanel } = useRecordDetailContext();
  const openDetailPanel = useOpenDetailPanel();
  const openRecord = useOpenRecordInSidePanel();
  const navigate = useNavigate();

  /**
   * Navigate to another entity's detail view.
   * In side panel: opens nested detail panel.
   * In main panel: navigates to full page.
   */
  const navigateToEntity = useCallback(
    (targetEntity: EntityType, targetId: string, label: string) => {
      if (isInSidePanel) {
        openDetailPanel(targetEntity, targetId, label);
      } else {
        // Route to the full detail page
        switch (targetEntity) {
          case "employee":
            navigate(AppRoute.employees.detail(targetId));
            break;
          case "department":
            navigate(AppRoute.departments.detail(targetId));
            break;
          case "device":
            navigate(AppRoute.devices.detail(targetId));
            break;
          default:
            break;
        }
      }
    },
    [isInSidePanel, openDetailPanel, navigate],
  );

  /**
   * Open the create form for an entity in the side panel.
   *
   * Uses the unified {@link useOpenRecordInSidePanel} hook (Twenty pattern).
   * For most entities this opens the RecordDetailRenderer in create mode.
   * Device creation opens the DeviceRegisterWizard.
   */
  const navigateToCreate = useCallback(
    (entityType: EntityType, label: string) => {
      openRecord({
        entityType,
        title: label,
        isNewRecord: true,
      });
    },
    [openRecord],
  );

  /**
   * @deprecated Use inline cell editing instead.
   * Editing is done on the record detail page — no separate edit navigation.
   */
  const navigateToEdit = useCallback(
    (_entityType: EntityType, _entityId: string, _label: string) => {
      // No-op: editing is now inline on the record detail page.
      // Kept for backward compatibility — callers should migrate to
      // inline cell editing or use navigateToCreate for new records.
    },
    [],
  );

  return { navigateToEntity, navigateToCreate, navigateToEdit };
}
