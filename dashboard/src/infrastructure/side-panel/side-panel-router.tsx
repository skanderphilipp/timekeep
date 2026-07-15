import { Suspense } from "react";
import { useAtomValue } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { sidePanelActiveEntryAtom } from "./side-panel-navigation-stack";
import { useSidePanelNavigation } from "./hooks/use-side-panel-navigation";
import { DeviceDetailView } from "./detail-views/device-detail-view";
import { PunchDetailView } from "./detail-views/punch-detail-view";
import { UserDetailView } from "./detail-views/user-detail-view";
import { DetailViewSkeleton } from "./detail-views/detail-view-skeleton";

// ── Side panel form imports (Phase 2b) ────────────────────────────────────

import { DepartmentFormSidePanel } from "@/modules/departments/components/department-form-side-panel";
import { UserFormSidePanel } from "@/modules/users/components/user-form-side-panel";

/**
 * Routes between entity detail views AND edit/create forms
 * based on the active side panel entry's entityType + mode.
 *
 * Pattern: analogous to Twenty's SidePanelRouter which switches
 * between page components based on SidePanelPages:
 *   twenty-front/src/modules/side-panel/components/SidePanelRouter.tsx
 *
 * When mode is 'view' (default), renders the read-only detail view.
 * When mode is 'edit' or 'create', renders the appropriate form.
 */
export function SidePanelRouter() {
  const activeEntry = useAtomValue(sidePanelActiveEntryAtom);

  if (!activeEntry) {
    return null;
  }

  return (
    <Suspense fallback={<DetailViewSkeleton />}>
      <SidePanelEntityRenderer entry={activeEntry} />
    </Suspense>
  );
}

// ── Entity Renderer ────────────────────────────────────────────────────────

type ActiveEntry = NonNullable<ReturnType<typeof useAtomValue<typeof sidePanelActiveEntryAtom>>>;

function SidePanelEntityRenderer({ entry }: { entry: ActiveEntry }) {
  const mode = entry.mode ?? "view";

  if (mode === "edit" || mode === "create") {
    return <SidePanelFormRouter entry={entry} mode={mode} />;
  }

  return <SidePanelDetailRouter entry={entry} />;
}

// ── Detail Router (view mode) ──────────────────────────────────────────────

function SidePanelDetailRouter({ entry }: { entry: ActiveEntry }) {
  switch (entry.entityType) {
    case "device":
      return <DeviceDetailView serialNumber={entry.entityId} />;
    case "punch":
      return <PunchDetailView punchId={entry.entityId} />;
    case "user":
    case "employee":
      return <UserDetailView userPin={entry.entityId} />;
    case "department":
    case "endpoint":
    case "api_key":
    case "audit":
      return <SidePanelPlaceholder entityType={entry.entityType} entityId={entry.entityId} />;
    default:
      return null;
  }
}

// ── Form Router (edit/create mode) ─────────────────────────────────────────

function SidePanelFormRouter({
  entry,
  mode,
}: {
  entry: ActiveEntry;
  mode: "edit" | "create";
}) {
  const { close } = useSidePanelNavigation();
  const isEdit = mode === "edit";
  const entityId = isEdit ? entry.entityId : undefined;

  switch (entry.entityType) {
    // ── Department (wired) ──────────────────────────────────────────────
    case "department":
      return (
        <DepartmentFormSidePanel
          departmentId={entityId}
          onClose={close}
        />
      );

    // ── API Key / Endpoint (wired) ──────────────────────────────────────
    case "api_key":
      return (
        /**
         * TODO(ENTERPRISE): Wire ApiKeyFormSidePanel with createKey mutation.
         *
         * Phase: Side Panel Editing (Phase 2b)
         * Impact: API key creation via side panel shows placeholder.
         * Fix: Import ApiKeyFormSidePanel and pass onCreateKey callback
         *       from the API key module's mutation hook.
         */
        <SidePanelFormPlaceholder
          title={entry.title}
          entityType={entry.entityType}
          mode={mode}
        />
      );

    // ── User (wired) ────────────────────────────────────────────────────
    case "user":
      return (
        <UserFormSidePanel
          userId={entityId}
          onClose={close}
        />
      );

    // ── Device (Phase 3 — Guided Flow) ──────────────────────────────────
    case "device":
    case "employee":
    case "audit":
    case "punch":
    default:
      return (
        <SidePanelFormPlaceholder
          title={entry.title}
          entityType={entry.entityType}
          mode={mode}
        />
      );
  }
}

// ── Placeholders ───────────────────────────────────────────────────────────

function SidePanelPlaceholder({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const { _ } = useLingui();
  return (
    <div style={{ padding: "16px" }}>
      <p>{_(msg`${entityType} detail: ${entityId}`)}</p>
    </div>
  );
}

function SidePanelFormPlaceholder({
  title,
  entityType,
  mode,
}: {
  title: string;
  entityType: string;
  mode: "edit" | "create";
}) {
  const { _ } = useLingui();
  const action = mode === "create" ? _(msg`Create`) : _(msg`Edit`);
  return (
    <div style={{ padding: "24px" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "var(--ao-font-size-lg)", fontWeight: "var(--ao-font-weight-semibold)" }}>
        {title}
      </h3>
      <p style={{ margin: 0, color: "var(--ao-font-color-tertiary)", fontSize: "var(--ao-font-size-sm)" }}>
        {_(msg`${action} ${entityType}`)} — {_(msg`wired in future phase`)}
      </p>
    </div>
  );
}
