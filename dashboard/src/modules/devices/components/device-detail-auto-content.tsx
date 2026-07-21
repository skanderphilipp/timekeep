import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useMemo, useState } from "react";
import {
  IconCloudDownload,
  IconUserOff,
  IconUsersPlus,
  IconArrowsExchange,
  IconRefresh,
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
  ConfirmDialog,
} from "@/components/ui";
import { ActivityFeed } from "@/modules/shared/components";
import { DeviceForm } from "./device-form";
import { DeviceUsersTab } from "./device-users-tab";
import { DeviceHealthCards } from "./device-health-cards";
import { EnrollEmployeeDialog } from "./enroll-employee-dialog";
import { DeviceToDeviceCopyDialog } from "./device-to-device-copy-dialog";
import { DeviceActionsMenu } from "./device-actions-menu";
import { useDeviceActions } from "../hooks/use-device-actions";
import { useDeviceActivity } from "../hooks/use-device-activity";
import { mapEventKind } from "../utils/device-detail-utils";
import { useQueryClient } from "@tanstack/react-query";

import styles from "./device-detail-view.module.scss";
import type { ReactNode } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(tsSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - tsSeconds;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Types ────────────────────────────────────────────────────────────────────

type DeviceDetailAutoContentProps = {
  device: DeviceDetailResponse;
};

// ── Status Bar (rendered above tabs, always visible) ────────────────────────

/**
 * Status bar with connection badge, health summary, Pull Attendance button,
 * and a ⋮ actions menu for device utilities.
 *
 * Pull Attendance is the primary direct command — it fetches records from the
 * device in real time and gives immediate feedback (records pulled, duration).
 * All other utility operations (Sync Clock, Restart, Clear Users, Delete) are
 * behind the actions dropdown to prevent accidental triggers.
 */
function DeviceStatusBar({ device }: DeviceDetailAutoContentProps) {
  const { _ } = useLingui();
  const { pullAttendance } = useDeviceActions(device.serial_number);
  const queryClient = useQueryClient();

  const statusValue: DeviceStatusValue = device.status ?? "offline";
  const statusDef = getDeviceStatus(statusValue);
  const statusUI = getDeviceStatusUI(statusValue);

  const healthSummary = useMemo(() => {
    const parts: string[] = [];
    const modeLabels: Record<string, string> = {
      both: "SDK + ADMS",
      sdk: "SDK only",
      adms: _(msg`ADMS-only`),
      offline: _(msg`Offline`),
    };
    const modeLabel = modeLabels[device.mode] ?? device.mode;
    parts.push(modeLabel);

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

      <div data-slot="spacer" style={{ flex: 1 }} />

      <Button
        variant="primary"
        size="sm"
        icon={<IconCloudDownload size={14} />}
        loading={pullAttendance.isPending}
        disabled={!device.can_pull_attendance}
        title={
          !device.can_pull_attendance
            ? _(msg`Attendance pull requires SDK connection. This device is in ${device.mode} mode.`)
            : _(msg`Pull attendance records from the device now.`)
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

// ── Overview Tab — Health Cards ─────────────────────────────────────────────

function DeviceOverviewTab({ device }: DeviceDetailAutoContentProps) {
  const hasCapacityData = device.user_capacity > 0 || device.record_capacity > 0;

  return (
    <Section>
      <DeviceHealthCards device={device} hasStats={hasCapacityData} />
    </Section>
  );
}

// ── Activity Tab — Merged Device Events + Audit Log ────────────────────────

/**
 * Activity tab content — merged device events + server audit log.
 *
 * Uses `useDeviceActivity` which returns the unified `DeviceActivityEntry`
 * stream (device-originated events like online/offline/sync + server-side
 * audit entries like config changes, deletions). This is richer than the
 * raw device events endpoint and shows SDK poll failures, ADMS errors,
 * and all server actions in one timeline.
 */
function DeviceActivityTab({ device }: DeviceDetailAutoContentProps) {
  const { _ } = useLingui();
  const activityQuery = useDeviceActivity(device.serial_number);

  // Map API events to TimelineEvent format (adds `kind` for visual categorization).
  const timelineEvents = useMemo(() => {
    const raw = activityQuery.data?.events ?? [];
    return raw.map((e) => ({
      id: e.id,
      label: e.label,
      timestamp: Math.floor(new Date(e.timestamp).getTime() / 1000),
      kind: mapEventKind(e.event_type),
      isProblem: e.is_problem,
    }));
  }, [activityQuery.data?.events]);

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
          <ActivityFeed
            events={timelineEvents}
            emptyMessage={emptyMessage}
          />
        </Card.Content>
      </Card>
    </Section>
  );
}

// ── Config Tab ──────────────────────────────────────────────────────────────

function DeviceConfigTabContent(_props: DeviceDetailAutoContentProps) {
  const queryClient = useQueryClient();
  return (
    <DeviceForm
      embedded
      onSaved={() => queryClient.invalidateQueries({ queryKey: ["devices"] })}
    />
  );
}

// ── Users Tab ───────────────────────────────────────────────────────────────

/**
 * Users tab toolbar — actions that operate on the device's user list.
 *
 * Separated from the table content for clean UX. Destructive operations
 * (Clear Device Users) require explicit confirmation with a warning about
 * data loss. Additive operations (Enroll, Copy from Device, Refresh) are
 * direct actions.
 */
function DeviceUsersToolbar({ device }: DeviceDetailAutoContentProps) {
  const { _ } = useLingui();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { refreshUsers, clearDeviceUsers } = useDeviceActions(device.serial_number);

  const sdkMissing = !device.can_sync_users;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={<IconUsersPlus size={16} />}
        disabled={sdkMissing}
        title={
          sdkMissing
            ? _(msg`Enrollment requires SDK connection. This device is in ${device.mode} mode.`)
            : _(msg`Start fingerprint or face enrollment for an employee on this device.`)
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
              : _(msg`Copy all users from another device to this one.`)
          }
          onClick={() => setCopyOpen(true)}
        >
          {_(msg`Copy from Device`)}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={<IconRefresh size={16} />}
          loading={refreshUsers.isPending}
          disabled={sdkMissing}
          title={
            sdkMissing
              ? _(msg`User refresh requires SDK connection. This device is in ${device.mode} mode.`)
              : _(msg`Pull the live user list from the device and update the local database.`)
          }
          onClick={() => refreshUsers.mutate()}
        >
          {_(msg`Refresh Users from Device`)}
        </Button>

        <div data-slot="spacer" style={{ flex: 1 }} />

        <Button
          variant="danger"
          size="sm"
          icon={<IconUserOff size={16} />}
          disabled={sdkMissing || clearDeviceUsers.isPending}
          title={
            sdkMissing
              ? _(msg`Clearing users requires SDK connection. This device is in ${device.mode} mode.`)
              : _(msg`Delete all users from the device. Use this before pushing a fresh employee list. Employees can be restored by syncing them back.`)
          }
          onClick={() => setShowClearConfirm(true)}
        >
          {_(msg`Clear Device Users`)}
        </Button>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title={_(msg`Clear All Users from Device`)}
        message={_(
          msg`This will permanently delete ALL users from the device "${device.label || device.serial_number}". Any users on the device that are not in the employee database will be lost. To restore users, push employees back to the device afterwards.`,
        )}
        confirmLabel={_(msg`Clear All Users`)}
        variant="danger"
        isPending={clearDeviceUsers.isPending}
        onConfirm={() =>
          clearDeviceUsers.mutate(undefined, {
            onSuccess: () => setShowClearConfirm(false),
          })
        }
      />

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

/**
 * Content for the "Users on Device" tab — toolbar + user table.
 *
 * The toolbar is rendered via the standardized `tabToolbar` system.
 * The table is the tab's main content (via `tabChildren`).
 */
// DeviceUsersTabContent removed — toolbar now uses tabToolbar pattern.
// See getDeviceDetailContent() where users tab is split into:
//   tabToolbars.users = <DeviceUsersToolbar>
//   tabChildren.users  = <DeviceUsersTab>

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Auto-injected device content for the RecordDetailRenderer.
 *
 * Returns tab children for all 4 tabs + a status bar rendered above the tabs
 * so the device connection state and quick actions are always visible.
 *
 * Tab layout:
 *   1. Overview  — declarative fields (Connection, Hardware, Status, Capacity)
 *                  + health stat cards
 *   2. Users     — toolbar (Enroll, Copy, Refresh, Clear) via tabToolbars
 *                  + user table via tabChildren
 *   3. Config    — device settings form
 *   4. Activity  — merged event timeline (device + server audit log)
 */
export function getDeviceDetailContent(
  device: DeviceDetailResponse,
): {
  tabChildren: Record<string, ReactNode>;
  tabToolbars: Record<string, ReactNode>;
  children: ReactNode;
} {
  return {
    tabChildren: {
      info: <DeviceOverviewTab device={device} />,
      config: <DeviceConfigTabContent device={device} />,
      users: <DeviceUsersTab deviceSn={device.serial_number} lastSyncAt={device.last_sync_at} />,
      activity: <DeviceActivityTab device={device} />,
    },
    tabToolbars: {
      users: <DeviceUsersToolbar device={device} />,
    },
    children: <DeviceStatusBar device={device} />,
  };
}
