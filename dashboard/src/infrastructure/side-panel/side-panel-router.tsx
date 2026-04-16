import { Suspense } from "react";
import { useAtomValue } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { sidePanelActiveEntryAtom } from "./side-panel-navigation-stack";
import { DeviceDetailView } from "./detail-views/device-detail-view";
import { PunchDetailView } from "./detail-views/punch-detail-view";
import { UserDetailView } from "./detail-views/user-detail-view";
import { DetailViewSkeleton } from "./detail-views/detail-view-skeleton";

/**
 * Routes between entity detail views based on the active side panel entry.
 *
 * Pattern: analogous to pulse's approach of rendering different detail
 * components based on the entity type of the active record.
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

function SidePanelEntityRenderer({
  entry,
}: {
  entry: NonNullable<ReturnType<typeof useAtomValue<typeof sidePanelActiveEntryAtom>>>;
}) {
  const { _ } = useLingui();

  switch (entry.entityType) {
    case "device":
      return <DeviceDetailView serialNumber={entry.entityId} />;
    case "punch":
      return <PunchDetailView punchId={entry.entityId} />;
    case "user":
      return <UserDetailView userPin={entry.entityId} />;
    case "api_key":
    case "audit":
      // Fallback for entities without a dedicated detail view yet
      return (
        <div style={{ padding: "16px" }}>
          <p>
            {_(msg`${entry.entityType} detail: ${entry.entityId}`)}
          </p>
        </div>
      );
    default:
      return null;
  }
}
