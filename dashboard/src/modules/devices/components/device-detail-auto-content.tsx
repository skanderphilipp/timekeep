import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useMemo, useState } from "react";
import {
  IconUsersPlus,
  IconArrowsExchange,
  IconCloudDownload,
} from "@tabler/icons-react";

import { getDeviceStatusUI } from "@/lib/device-status-ui";
import { getDeviceStatus, type DeviceStatusValue } from "@shared/device-statuses";
import type { DeviceDetailResponse } from "@/lib/api";
import {
  Section,
  Card,
  Badge,
  Text,
  Button,
} from "@/components/ui";
import { ActivityFeed } from "@/modules/shared/components";
import { DeviceForm } from "./device-form";
import { DeviceUsersTab } from "./device-users-tab";
import { DeviceHealthCards } from "./device-health-cards";
import { EnrollEmployeeDialog } from "./enroll-employee-dialog";
import { DeviceToDeviceCopyDialog } from "./device-to-device-copy-dialog";
import { UserSyncActions } from "./user-sync-actions";
import { DeviceActionsMenu } from "./device-actions-menu";
import { useDeviceCommand } from "../hooks/use-device-command";
import { useDeviceEvents, type DeviceEvent } from "../hooks/use-device-events";
import { mapEventKind } from "../utils/device-detail-utils";
import { useQueryClient } from "@tanstack/react-query";

import styles from "./device-detail-view.module.scss";
import type { ReactNode } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Unix timestamp as a relative time string like "12s ago", "5m ago". */
function relativeTime(tsSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - tsSeconds;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type DeviceActivityEvent = {
  id: string;
  label: string;
  timestamp: number;
  kind: "online" | "offline" | "sync" | "warning" | "config" | "provision";
  isProblem?: boolean;
};

type DeviceDetailAutoContentProps = {
  device: DeviceDetailResponse;
};

// ── Status Bar (rendered above tabs as children) ───────────────────────────

/**
 * Status bar with connection badge, health indicators, Pull Attendance button,
 * and a ⋮ actions menu for device utilities.
 *
 * Rendered as `children` above the tabs so it's always visible.
 * All utility operations (Restart, Sync Clock, Full Re-sync, Delete) are
 * behind the actions menu to prevent accidental triggers.
 */
function DeviceStatusBar({ device }: DeviceDetailAutoContentProps) {
  const { _ } = useLingui();
  const { pullAttendance } = useDeviceCommand(device.serial_number);
  const queryClient = useQueryClient();

  const statusValue: DeviceStatusValue = device.status ?? "offline";
  const statusDef = getDeviceStatus(statusValue);
  const statusUI = getDeviceStatusUI(statusValue);

  const healthSummary = useMemo(() => {
    const parts: string[] = [];
    // Mode pill
    const modeLabels: Record<string, string> = {
      both: "SDK + ADMS",
      sdk: "SDK only",
      adms: _(msg`ADMS-only`),
      offline: _(msg`Offline`),
    };
    const modeLabel = modeLabels[device.mode] ?? device.mode;
    parts.push(modeLabel);

    // Detail
    if (device.adms_active) parts.push(_(msg`ADMS active`));
    if (device.sdk_poll_active) {
      const pollText = device.sdk_last_poll
        ? `${_(msg`SDK polling`)} · ${relativeTime(device.sdk_last_poll)}`
        : _(msg`SDK polling`);
      parts.push(pollText);
    } else if (device.mode !== "offline") {
      parts.push(_(msg`SDK inactive`));
    }
    if (device.last_seen_at) {
      parts.push(`${_(msg`Last seen`)}: ${relativeTime(device.last_seen_at)}`);
    }
    return parts.join(" · ");
  }, [
    _,
    device.mode,
    device.adms_active,
    device.sdk_poll_active,
    device.sdk_last_poll,
    device.last_seen_at,
  ]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["devices", device.serial_number],
    });
  };

  return (
    <Section className={styles.statusRow}>
      <Badge variant={statusUI.variant} dot={statusUI.dotColor} size="md">
        {statusDef?.label ?? statusValue}
      </Badge>

      <Text variant="caption" color="tertiary">
        {_(msg`SN: ${device.serial_number}`)}
      </Text>

      <Text variant="caption" color="secondary">
        {healthSummary}
      </Text>

      {/* Spacer — pushes actions to the right */}
      <div style={{ flex: 1 }} />

      <Button
        variant="primary"
        size="sm"
        icon={<IconCloudDownload size={14} />}
        loading={pullAttendance.isPending}
        disabled={!device.can_pull_attendance}
        title={
          !device.can_pull_attendance
            ? _(msg`Attendance pull requires SDK connection. This device is in ${device.mode} mode.`)
            : undefined
        }
        onClick={() => pullAttendance.mutate()}
      >
        {_(msg`Pull Attendance`)}
      </Button>

      <DeviceActionsMenu
        deviceSn={device.serial_number}
        deviceLabel={device.label || device.serial_number}
        canSyncClock={device.can_sync_clock}
        canRestart={device.can_restart}
        onRefresh={handleRefresh}
      />
    </Section>
  );
}

// ── Overview Tab — Health Cards ────────────────────────────────────────────

/**
 * Overview tab content — device health stat cards.
 *
 * Rendered inside the first "Overview" tab via `tabChildren.info`.
 * The declarative field sections (Connection, Hardware, Status, Capacity)
 * are rendered by RecordDetailFields BEFORE this content.
 */
function DeviceOverviewTab({ device }: DeviceDetailAutoContentProps) {
  const hasCapacityData = device.user_capacity > 0 || device.record_capacity > 0;

  return (
    <Section>
      <DeviceHealthCards device={device} hasStats={hasCapacityData} />
    </Section>
  );
}

// ── Activity Tab ───────────────────────────────────────────────────────────

/**
 * Activity tab content — device event timeline.
 *
 * Rendered inside the "Activity" tab via `tabChildren.activity`.
 * Shows online/offline transitions, sync events, config changes, and warnings.
 */
function DeviceActivityTab({ device }: DeviceDetailAutoContentProps) {
  const { _ } = useLingui();
  const { data: rawEvents } = useDeviceEvents(device.serial_number);

  const activityEvents: DeviceActivityEvent[] | undefined = rawEvents?.map(
    (e: DeviceEvent): DeviceActivityEvent => ({
      id: e.id,
      label: e.label,
      timestamp: e.timestamp,
      kind: mapEventKind(e.event_type),
      isProblem: e.is_problem,
    }),
  );

  const emptyMessage = useMemo(() => {
    if (device.mode === "adms") {
      return _(
        msg`This device is in ADMS-only mode. Attendance records are received when the device pushes data to the server. No SDK polling events will appear here.`,
      );
    }
    if (device.mode === "offline") {
      return _(
        msg`Device is offline. Activity will appear once the device connects and starts reporting events.`,
      );
    }
    return _(
      msg`Device activity will appear here once the engine starts collecting events.`,
    );
  }, [_, device.mode]);

  return (
    <Section>
      <Card>
        <Card.Content>
          <ActivityFeed events={activityEvents ?? []} emptyMessage={emptyMessage} />
        </Card.Content>
      </Card>
    </Section>
  );
}

// ── Config Tab ─────────────────────────────────────────────────────────────

/**
 * Content for the "Config" tab — device settings form.
 * Self-contained: reads entityId from RecordDetailContext for the serial number.
 */
function DeviceConfigTabContent(_props: DeviceDetailAutoContentProps) {
  const queryClient = useQueryClient();
  return (
    <DeviceForm
      embedded
      onSaved={() => queryClient.invalidateQueries({ queryKey: ["devices"] })}
    />
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────

/**
 * Content for the "Users on Device" tab — user sync, enroll, and copy.
 */
function DeviceUsersTabContent({ device }: DeviceDetailAutoContentProps) {
  const { _ } = useLingui();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const sdkMissing = !device.can_sync_users;

  return (
    <>
      <UserSyncActions deviceSn={device.serial_number} />
      <Button
        variant="secondary"
        size="sm"
        icon={<IconUsersPlus size={16} />}
        disabled={sdkMissing}
        title={
          sdkMissing
            ? _(msg`Enrollment requires SDK connection. This device is in ${device.mode} mode.`)
            : undefined
        }
        onClick={() => setEnrollOpen(true)}
      >
        {_(msg`Enroll Employee`)}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<IconArrowsExchange size={16} />}
        disabled={sdkMissing}
        title={
          sdkMissing
            ? _(msg`Device-to-device copy requires SDK connection. This device is in ${device.mode} mode.`)
            : undefined
        }
        onClick={() => setCopyOpen(true)}
      >
        {_(msg`Copy from Device`)}
      </Button>
      <DeviceUsersTab deviceSn={device.serial_number} />

      <EnrollEmployeeDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        deviceSn={device.serial_number}
      />
      <DeviceToDeviceCopyDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        targetSn={device.serial_number}
      />
    </>
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Auto-injected device content for the RecordDetailRenderer.
 *
 * Returns tab children for all 4 tabs + a status bar (children) rendered
 * above the tabs so the device connection state and quick actions are
 * always visible regardless of which tab is active.
 *
 * Tab layout:
 *   1. Overview  — declarative fields (Connection, Hardware, Status, Capacity)
 *                  + health stat cards (via tabChildren)
 *   2. Users     — resync, enroll, copy-from + user table
 *   3. Config    — device settings form
 *   4. Activity  — event timeline
 *
 * Used by both the main panel page and the side panel router —
 * no duplication between the two rendering paths.
 */
export function getDeviceDetailContent(
  device: DeviceDetailResponse,
): {
  tabChildren: Record<string, ReactNode>;
  children: ReactNode;
} {
  return {
    tabChildren: {
      info: <DeviceOverviewTab device={device} />,
      config: <DeviceConfigTabContent device={device} />,
      users: <DeviceUsersTabContent device={device} />,
      activity: <DeviceActivityTab device={device} />,
    },
    children: <DeviceStatusBar device={device} />,
  };
}
