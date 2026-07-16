import { Suspense } from "react";
import { useAtomValue } from "jotai";

import { sidePanelActiveEntryAtom } from "./side-panel-navigation-stack";
import { ListLoading } from "@/components/ui";

// ── Unified detail renderer (ADR-008) ─────────────────────────────────────
import { RecordDetailRenderer } from "@/modules/record-detail";

// ── Device wizard (special case: multi-step create flow) ──────────────────
import { DeviceRegisterWizard } from "@/modules/devices/components/device-register-wizard/device-register-root";
import { useSidePanelNavigation } from "./hooks/use-side-panel-navigation";


export function SidePanelRouter() {
  const activeEntry = useAtomValue(sidePanelActiveEntryAtom);

  if (!activeEntry) {
    return null;
  }

  return (
    <Suspense fallback={<ListLoading />}>
      <SidePanelPageRenderer entry={activeEntry} />
    </Suspense>
  );
}

// ── Page Renderer — single routing path (no view/edit split) ────────────────

type ActiveEntry = NonNullable<
  ReturnType<typeof useAtomValue<typeof sidePanelActiveEntryAtom>>
>;

/**
 * Routes to the correct panel content based on the active entry.
 *
 * Pattern: analogous to Twenty's SidePanelRouter which looks up
 * page components from SIDE_PANEL_PAGES_CONFIG:
 *   twenty-front/src/modules/side-panel/components/SidePanelRouter.tsx
 *
 * Architecture (aligned with Twenty):
 *   - entityId === "" → new record (RecordDetailRenderer with empty form)
 *     EXCEPT device → DeviceRegisterWizard (multi-step guided flow)
 *   - entityId !== "" → existing record (inline-editable detail view)
 *
 * No separate "mode" concept — isNewRecord is derived from entityId
 * (Twenty pattern, see ADR-008).
 *
 * To add a new entity:
 *   1. Add a `DetailViewConfig` entry to `modules/record-detail/types.ts`
 *   2. Add a case to `useRecordDetail` hook
 *   3. Done — the RecordDetailRenderer handles both view and create.
 */
function SidePanelPageRenderer({ entry }: { entry: ActiveEntry }) {
  /** Twenty pattern: derive isNewRecord from empty entityId, no separate mode. */
  const isNewRecord = entry.entityId.length === 0;

  // ── New record — Device wizard is a special case ──────────────────────
  if (isNewRecord && entry.entityType === "device") {
    return <DeviceWizardAdapter entry={entry} />;
  }

  // ── All other cases (new or existing) use RecordDetailRenderer ────────
  return (
    <RecordDetailRenderer
      entity={entry.entityType}
      entityId={entry.entityId}
      isInSidePanel={true}
    />
  );
}

// ── Device Wizard Adapter ───────────────────────────────────────────────────

/**
 * Adapter that bridges the SidePanelRouter to the DeviceRegisterWizard.
 *
 * The wizard manages its own sub-page stack and takes an `onClose` callback
 * that closes the side panel via the navigation hook.
 */
function DeviceWizardAdapter({ entry: _entry }: { entry: ActiveEntry }) {
  const { close } = useSidePanelNavigation();
  return <DeviceRegisterWizard onClose={close} />;
}
