import { useAtomValue, useSetAtom } from "jotai";
import { Suspense, useCallback, useEffect, useRef } from "react";

import { SidePanel } from "@/infrastructure/side-panel/components/side-panel/side-panel";
import { Spinner } from "@/components/ui/spinner";
import {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
  closeSidePanelAtom,
} from "@/infrastructure/state";

import {
  sidePanelStackAtom,
  sidePanelActiveEntryAtom,
  clearSidePanelStackAtom,
} from "./side-panel-navigation-stack";
import { clearSubPagesAtom } from "./side-panel-sub-page-stack";
import { SidePanelRouter } from "./side-panel-router";
import { useSidePanelActions } from "./hooks/use-side-panel-actions";

/**
 * Side panel shell — bridges atoms + navigation stack to the SidePanel UI.
 *
 * Panel states (priority order):
 * 1. Navigation stack entries → SidePanelRouter (entity detail views)
 * 2. Legacy content atom → renderContent()
 * 3. Nothing (panel closed)
 *
 * Header actions:
 *   - "Open in Main View" icon button — navigates to full-page route
 *
 * Footer actions (entity commands):
 *   - "Edit" — opens the edit form for the current entity
 *   - Future: Delete, Duplicate, etc.
 *
 * Twenty references:
 *   twenty-front/src/modules/side-panel/components/SidePanelTopBarRightCornerIcon.tsx
 *   twenty-front/src/modules/ui/layout/side-panel/components/SidePanelFooter.tsx
 *
 * Cmd+K is handled by {@link AppTopBar} — it registers the global hotkey
 * and pushes the command view into the panel via the legacy content atoms.
 */
export function SidePanelShell() {
  const legacyOpen = useAtomValue(sidePanelOpenAtom);
  const legacyTitle = useAtomValue(sidePanelTitleAtom);
  const legacyContent = useAtomValue(sidePanelContentAtom);

  const stack = useAtomValue(sidePanelStackAtom);
  const activeEntry = useAtomValue(sidePanelActiveEntryAtom);
  const clearStack = useSetAtom(clearSidePanelStackAtom);
  const clearSubPages = useSetAtom(clearSubPagesAtom);
  const legacyClose = useSetAtom(closeSidePanelAtom);

  const hasStackEntries = stack.length > 0;
  const isOpen = legacyOpen || hasStackEntries;
  const title = hasStackEntries ? (activeEntry?.title ?? "") : (legacyTitle ?? "");

  // Header actions (entity-aware footer actions are rendered
  // by RecordDetailActions inside the side panel content).
  const { headerActions } = useSidePanelActions();

  // Clear sub-pages (wizard steps) when the navigation entry changes
  const prevInstanceIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = activeEntry?.instanceId ?? null;
    if (currentId !== prevInstanceIdRef.current) {
      clearSubPages();
      prevInstanceIdRef.current = currentId;
    }
  }, [activeEntry?.instanceId, clearSubPages]);

  const handleClose = useCallback(() => {
    if (hasStackEntries) {
      clearStack();
      clearSubPages();
    }
    legacyClose();
  }, [hasStackEntries, clearStack, clearSubPages, legacyClose]);

  // Determine content
  let content: React.ReactNode = null;
  if (hasStackEntries) {
    content = <SidePanelRouter />;
  } else if (typeof legacyContent === "function") {
    content = legacyContent();
  }

  return (
    <SidePanel
      open={isOpen}
      onClose={handleClose}
      title={title}
      headerActions={headerActions}
    >
      <Suspense fallback={<Spinner />}>{content}</Suspense>
    </SidePanel>
  );
}
