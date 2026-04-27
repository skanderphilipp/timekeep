import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PageBar, Text, IconButton } from "@/components/ui";
import { IconRefresh } from "@tabler/icons-react";

type DashboardHeaderActionsProps = {
  secondsSinceUpdate: number | null;
  onRefresh: () => void;
};

function formatUpdated(seconds: number | null, _: ReturnType<typeof useLingui>["_"]): string {
  if (seconds === null) return "";
  if (seconds < 30) return _(msg`Updated just now`);
  if (seconds < 60) return _(msg`Updated ${seconds}s ago`);
  if (seconds < 3600) return _(msg`Updated ${Math.floor(seconds / 60)}m ago`);
  return _(msg`Updated ${Math.floor(seconds / 3600)}h ago`);
}

export function DashboardHeaderActions({ secondsSinceUpdate, onRefresh }: DashboardHeaderActionsProps) {
  const { _ } = useLingui();
  const now = new Date();

  return (
    <PageBar
      title={_(msg`Dashboard`)}
      description={_(msg`Attendance overview and device status.`)}
      actions={
        <>
          <Text variant="caption" color="tertiary">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" · "}
            {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </Text>
          <IconButton onClick={onRefresh} aria-label={_(msg`Refresh dashboard`)} title={_(msg`Refresh`)}>
            <IconRefresh size={16} />
          </IconButton>
          <Text variant="caption" color="tertiary">
            {formatUpdated(secondsSinceUpdate, _)}
          </Text>
        </>
      }
    />
  );
}
