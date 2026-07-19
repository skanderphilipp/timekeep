import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useState } from "react";
import {
  IconTrash,
  IconUsersPlus,
  IconArrowsExchange,
  IconClock,
  IconPower,
  IconCloudUpload,
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
  IconButton,
} from "@/components/ui";
import { ActivityFeed } from "@/modules/shared/components";
import { DeviceForm } from "./device-form";
import { DeviceUsersTab } from "./device-users-tab";
import { DeviceHealthCards } from "./device-health-cards";
import { EnrollEmployeeDialog } from "./enroll-employee-dialog";
import { DeviceToDeviceCopyDialog } from "./device-to-device-copy-dialog";
import { UserSyncActions } from "./user-sync-actions";
import { useDeleteDevice } from "../hooks/use-delete-device";
import { useDeviceCommand } from "../hooks/use-device-command";
import { useSyncActions } from "../hooks/use-sync-actions";
import { useDeviceEvents, type DeviceEvent } from "../hooks/use-device-events";
import { mapEventKind } from "../utils/device-detail-utils";
import { useQueryClient } from "@tanstack/react-query";

import styles from "./device-detail-view.module.scss";
import type { ReactNode } from "react";

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
 * Status bar with connection badge, serial number, quick action buttons,
 * and delete. Rendered as `children` above the tabs so it's always visible.
 */
function DeviceStatusBar({ device }: DeviceDetailAutoContentProps) {
  const { _ } = useLingui();
  const { restart, syncClock } = useDeviceCommand(device.serial_number);
  const { resync } = useSyncActions(device.serial_number);
  const deleteMutation = useDeleteDevice();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [resyncOpen, setResyncOpen] = useState(false);

  const statusValue: DeviceStatusValue = device.status ?? "offline";
  const statusDef = getDeviceStatus(statusValue);
  const statusUI = getDeviceStatusUI(statusValue);

  return (
    <>
      <Section className={styles.statusRow}>
        <Badge variant={statusUI.variant} dot={statusUI.dotColor} size="md">
          {statusDef?.label ?? statusValue}
        </Badge>

        <Text variant="caption" color="tertiary">
          {_(msg`SN: ${device.serial_number}`)}
        </Text>

        {/* Spacer — pushes actions to the right */}
        <div style={{ flex: 1 }} />

        <Button
          variant="secondary"
          size="sm"
          icon={<IconClock size={14} />}
          loading={syncClock.isPending}
          onClick={() => syncClock.mutate()}
        >
          {_(msg`Sync Clock`)}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={<IconPower size={14} />}
          onClick={() => setRestartOpen(true)}
        >
          {_(msg`Restart`)}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={<IconCloudUpload size={14} />}
          loading={resync.isPending}
          onClick={() => setResyncOpen(true)}
        >
          {_(msg`Full Re-sync`)}
        </Button>

        <IconButton
          aria-label={_(msg`Delete device`)}
          onClick={() => setDeleteOpen(true)}
        >
          <IconTrash size={16} />
        </IconButton>
      </Section>

      {/* ── Confirmation Dialogs ── */}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={_(msg`Delete Device`)}
        message={_(
          msg`Are you sure you want to remove "${device.label || device.serial_number}"? This action cannot be undone.`,
        )}
        confirmLabel={_(msg`Delete`)}
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(device.serial_number)}
      />

      <ConfirmDialog
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title={_(msg`Restart Device`)}
        message={_(
          msg`The device will reboot and be offline for about 30–60 seconds. Attendance records already stored on the device are safe.`,
        )}
        confirmLabel={_(msg`Restart`)}
        variant="danger"
        isPending={restart.isPending}
        onConfirm={() => restart.mutate()}
      />

      <ConfirmDialog
        open={resyncOpen}
        onOpenChange={setResyncOpen}
        title={_(msg`Full Re-sync`)}
        message={_(
          msg`This will pull all users and attendance records from the device and push any pending changes. The device will remain online during this operation.`,
        )}
        confirmLabel={_(msg`Re-sync`)}
        isPending={resync.isPending}
        onConfirm={() => resync.mutate(undefined)}
      />
    </>
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

  return (
    <Section>
      <Card>
        <Card.Content>
          <ActivityFeed
            events={activityEvents ?? []}
            emptyMessage={_(
              msg`Device activity will appear here once the engine starts collecting events.`,
            )}
          />
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

  return (
    <>
      <UserSyncActions deviceSn={device.serial_number} />
      <Button
        variant="secondary"
        size="sm"
        icon={<IconUsersPlus size={16} />}
        onClick={() => setEnrollOpen(true)}
      >
        {_(msg`Enroll Employee`)}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<IconArrowsExchange size={16} />}
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
