import { useAtomValue, useSetAtom } from "jotai";
import { Suspense, useCallback } from "react";

import { SidePanel } from "@/infrastructure/side-panel/components/side-panel";
import { Spinner } from "@/components/ui/spinner";
import {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
  closeSidePanelAtom,
} from "@/infrastructure/state";
import { useGlobalHotkey } from "@/infrastructure/keyboard/hotkeys";

import {
  sidePanelStackAtom,
  sidePanelActiveEntryAtom,
  clearSidePanelStackAtom,
} from "./side-panel-navigation-stack";
import { SidePanelRouter } from "./side-panel-router";
import { SidePanelCmdk } from "./components/side-panel-cmdk";

/**
 * Side panel shell — bridges atoms + navigation stack to the SidePanel UI.
 *
 * Panel states (priority order):
 * 1. Navigation stack entries → SidePanelRouter (entity detail views)
 * 2. Legacy content atom → renderContent()
 * 3. Nothing (panel closed)
 *
 * Cmd+K is handled by {@link SidePanelCmdkHandler} — a separate component
 * that registers the global hotkey and pushes the command view into the
 * panel via the legacy content atoms.
 */
export function SidePanelShell() {
  const legacyOpen = useAtomValue(sidePanelOpenAtom);
  const legacyTitle = useAtomValue(sidePanelTitleAtom);
  const legacyContent = useAtomValue(sidePanelContentAtom);

  const stack = useAtomValue(sidePanelStackAtom);
  const activeEntry = useAtomValue(sidePanelActiveEntryAtom);
  const clearStack = useSetAtom(clearSidePanelStackAtom);
  const legacyClose = useSetAtom(closeSidePanelAtom);

  const hasStackEntries = stack.length > 0;
  const isOpen = legacyOpen || hasStackEntries;
  const title = hasStackEntries ? (activeEntry?.title ?? "") : (legacyTitle ?? "");

  const handleClose = useCallback(() => {
    if (hasStackEntries) clearStack();
    legacyClose();
  }, [hasStackEntries, clearStack, legacyClose]);

  // Determine content
  let content: React.ReactNode = null;
  if (hasStackEntries) {
    content = <SidePanelRouter />;
  } else if (typeof legacyContent === "function") {
    content = legacyContent();
  }

  return (
    <SidePanel open={isOpen} onClose={handleClose} title={title}>
      <Suspense fallback={<Spinner />}>{content}</Suspense>
    </SidePanel>
  );
}

/**
 * Cmd+K / Ctrl+K global hotkey handler.
 *
 * Renders nothing visibly — just registers the keyboard shortcut.
 * When pressed, opens the side panel with the command palette view.
 * If the panel is already open, closes it (toggle behavior).
 */
export function SidePanelCmdkHandler() {
  const isOpen = useAtomValue(sidePanelOpenAtom);
  const setOpen = useSetAtom(sidePanelOpenAtom);
  const setTitle = useSetAtom(sidePanelTitleAtom);
  const setContent = useSetAtom(sidePanelContentAtom);
  const close = useSetAtom(closeSidePanelAtom);

  useGlobalHotkey(
    ["ctrl+k", "meta+k"],
    () => {
      if (isOpen) {
        close();
      } else {
        setTitle("Commands");
        setContent(() => <SidePanelCmdk onClose={() => close()} />);
        setOpen(true);
      }
    },
    [isOpen, setOpen, setTitle, setContent, close],
  );

  return null;
}
