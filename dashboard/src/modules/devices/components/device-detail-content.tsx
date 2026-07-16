import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useState } from "react";
import {
  IconTrash,
  IconUsersPlus,
  IconArrowsExchange,
} from "@tabler/icons-react";

import { getDeviceStatusUI } from "@/lib/device-status-ui";
import { getDeviceStatus, type DeviceStatusValue } from "@shared/device-statuses";
import type { DeviceDetailResponse, DeviceHealthInfo } from "@/lib/api";
import { Section, Card, Badge, Text, Button, ConfirmDialog, IconButton } from "@/components/ui";
import { ActivityFeed } from "@/modules/shared/components";
import { DeviceForm } from "./device-form";
import { DeviceUsersTab } from "./device-users-tab";
import { DeviceHealthCards } from "./device-health-cards";
import { DeviceActionsMenu } from "./device-actions-menu";
import { EnrollEmployeeDialog } from "./enroll-employee-dialog";
import { DeviceToDeviceCopyDialog } from "./device-to-device-copy-dialog";
import { UserSyncActions } from "./user-sync-actions";
import { useDeleteDevice } from "../hooks/use-delete-device";
import { useDeviceEvents, type DeviceEvent } from "../hooks/use-device-events";
import { mapEventKind } from "../utils/device-detail-utils";

import styles from "./device-detail-view.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────

export type DeviceActivityEvent = {
  id: string;
  label: string;
  timestamp: number;
  kind: "online" | "offline" | "sync" | "warning" | "config" | "provision";
  isProblem?: boolean;
};

type DeviceDetailExtrasProps = {
  device: DeviceDetailResponse;
  deviceHealth?: DeviceHealthInfo | null;
  onRefresh: () => void;
};

/**
 * Extra UI elements rendered outside the record-detail tabs:
 * status bar, health cards, activity feed, and action dialogs.
 *
 * Passed as `children` to {@link RecordDetailRenderer}.
 */
export function DeviceDetailExtras({
  device,
  deviceHealth: _deviceHealth,
  onRefresh,
}: DeviceDetailExtrasProps) {
  const { _ } = useLingui();

  const deleteMutation = useDeleteDevice();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

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

  const statusValue: DeviceStatusValue = device.status ?? "offline";
  const statusDef = getDeviceStatus(statusValue);
  const statusUI = getDeviceStatusUI(statusValue);
  const hasCapacityData = device.user_capacity > 0 || device.record_capacity > 0;

  return (
    <>
      {/* Status bar + serial + actions */}
      <Section className={styles.statusRow}>
        <Badge variant={statusUI.variant} dot={statusUI.dotColor} size="md">
          {statusDef?.label ?? statusValue}
        </Badge>
        <Text variant="caption" color="tertiary">
          {_(msg`SN: ${device.serial_number}`)}
        </Text>
        <DeviceActionsMenu deviceSn={device.serial_number} onRefresh={onRefresh} />
        <IconButton aria-label={_(msg`Delete device`)} onClick={() => setDeleteOpen(true)}>
          <IconTrash size={16} />
        </IconButton>
      </Section>

      {/* Health cards */}
      <Section>
        <DeviceHealthCards device={device} hasStats={hasCapacityData} />
      </Section>

      {/* Activity timeline */}
      <Section>
        <Card>
          <Card.Content>
            <Text variant="label" className={styles.sectionTitle}>
              {_(msg`Activity`)}
            </Text>
            <ActivityFeed
              events={activityEvents ?? []}
              emptyMessage={_(
                msg`Device activity will appear here once the engine starts collecting events.`,
              )}
            />
          </Card.Content>
        </Card>
      </Section>

      {/* Dialogs */}
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

// ── Tab Content Components ──────────────────────────────────────────────────

type DeviceTabContentProps = {
  device: DeviceDetailResponse;
  onRefresh: () => void;
};

/**
 * Content for the "Config" tab — device settings form.
 * Passed as `tabChildren.config` to {@link RecordDetailRenderer}.
 */
export function DeviceConfigTabContent({ onRefresh }: DeviceTabContentProps) {
  return <DeviceForm embedded onSaved={onRefresh} />;
}

/**
 * Content for the "Users on Device" tab — user sync, enroll, and copy.
 * Passed as `tabChildren.users` to {@link RecordDetailRenderer}.
 */
export function DeviceUsersTabContent({ device }: DeviceTabContentProps) {
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

// ── Legacy wrapper (backward compat) ────────────────────────────────────────

/**
 * @deprecated Use {@link DeviceDetailExtras} + {@link DeviceConfigTabContent} +
 *   {@link DeviceUsersTabContent} with `tabChildren` on `RecordDetailRenderer`.
 *
 * The tab rendering (Info / Config / Users) is now handled declaratively by
 * `DETAIL_VIEW_CONFIGS.device.tabs`. Complex tab content goes through
 * `tabChildren`, and non-tab extras go through `children`.
 *
 * Kept for backward compatibility with any code that still imports this.
 */
export function DeviceDetailContent({
  device,
  deviceHealth,
  onRefresh,
}: DeviceDetailExtrasProps) {
  return (
    <DeviceDetailExtras device={device} deviceHealth={deviceHealth} onRefresh={onRefresh} />
  );
}
