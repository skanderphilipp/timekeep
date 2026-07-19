import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconArrowsMaximize } from "@tabler/icons-react";

import { IconButton } from "@/components/ui/icon-button";
import { useOpenInMainView } from "./use-open-in-main-view";
import { useSidePanelNavigation } from "./use-side-panel-navigation";

/**
 * Side panel header actions.
 *
 * Entity-specific actions (Sync, Delete, etc.) are now rendered by
 * {@link RecordDetailActions} inside the side panel content — not here.
 * This hook only provides the "Open in main view" header action.
 *
 * Twenty reference:
 *   `SidePanelTopBarRightCornerIcon` — header actions
 */
export function useSidePanelActions() {
  const { _ } = useLingui();
  const { activeEntry, isOpen } = useSidePanelNavigation();
  const { openInMainView, canOpenInMainView } = useOpenInMainView();

  /** Existing record (not a creation flow) — entityId is non-empty. */
  const isDetailView = isOpen && (activeEntry?.entityId.length ?? 0) > 0;

  // "Open in Main View" icon button (right-corner of side panel header)
  const headerActions = useMemo(() => {
    if (!isDetailView || !canOpenInMainView) return null;

    return (
      <IconButton
        size="sm"
        accent="tertiary"
        aria-label={_(msg`Open in main view`)}
        onClick={openInMainView}
      >
        <IconArrowsMaximize size={16} />
      </IconButton>
    );
  }, [isDetailView, canOpenInMainView, openInMainView, _]);

  return { headerActions } as const;
}
