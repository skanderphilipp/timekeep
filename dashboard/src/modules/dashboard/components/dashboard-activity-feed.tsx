import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

import { Text, Badge, ListItem, EmptyState, Card } from "@/components/ui";
import type { DashboardRecentEvent } from "@/lib/api";

type DashboardActivityFeedProps = {
  events?: DashboardRecentEvent[];
};

function formatTimeAgo(ts: number, _: (msg: MessageDescriptor) => string): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return _(msg`just now`);
  if (diff < 3600) return _(msg`${Math.floor(diff / 60)}m ago`);
  if (diff < 86400) return _(msg`${Math.floor(diff / 3600)}h ago`);
  return new Date(ts * 1000).toLocaleDateString();
}

function formatStatus(status: string, _: (msg: MessageDescriptor) => string): string {
  switch (status) {
    case "check_in":
      return _(msg`Check In`);
    case "check_out":
      return _(msg`Check Out`);
    case "break_out":
      return _(msg`Break Out`);
    case "break_in":
      return _(msg`Break In`);
    case "overtime_in":
      return _(msg`OT In`);
    case "overtime_out":
      return _(msg`OT Out`);
    default:
      return status;
  }
}

function statusBadgeVariant(status: string): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (status) {
    case "check_in":
    case "overtime_in":
    case "break_in":
      return "success";
    case "break_out":
    case "overtime_out":
      return "warning";
    case "check_out":
      return "info";
    default:
      return "neutral";
  }
}

export function DashboardActivityFeed({ events }: DashboardActivityFeedProps) {
  const { _ } = useLingui();

  if (!events || events.length === 0) {
    return (
      <EmptyState
        title={_(msg`No Recent Activity`)}
        description={_(msg`Attendance records will appear here as employees scan in.`)}
      />
    );
  }

  return (
    <Card>
      <Card.Header title={_(msg`Recent Activity`)} />
      <Card.Content>
        {events.map((event, i) => (
          <ListItem key={`${event.timestamp}-${event.user_pin}-${i}`}>
            <ListItem.Leading>
              <Text variant="body" weight="medium">
                {event.employee_name ?? event.user_pin}
              </Text>
              <Text variant="caption" color="tertiary">
                {event.device_sn}
              </Text>
            </ListItem.Leading>
            <ListItem.Trailing>
              <Badge variant={statusBadgeVariant(event.status)}>
                {formatStatus(event.status, _)}
              </Badge>
              <Text variant="caption" color="tertiary">
                {formatTimeAgo(event.timestamp, _)}
              </Text>
            </ListItem.Trailing>
          </ListItem>
        ))}
      </Card.Content>
    </Card>
  );
}
