import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconArrowsMaximize } from "@tabler/icons-react";

import { IconButton } from "@/components/ui/icon-button";
import { useOpenInMainView } from "./use-open-in-main-view";
import { useSidePanelNavigation } from "./use-side-panel-navigation";

/**
 * Extra-verbose header action, currently "open in main view".
 * Twenty reference: `SidePanelTopBarRightCornerIcon`
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

  // Footer: inline editing is the mechanism for modifying records.
  // There is no explicit "Edit" button — all editable fields are
  // click-to-edit on the record detail page (Twenty pattern).
  const editButton = null;

  return { headerActions, editButton } as const;
}
