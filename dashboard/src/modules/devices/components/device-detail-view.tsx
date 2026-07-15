import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useState } from "react";
import {
  IconInfoCircle,
  IconSettings,
  IconUserCircle,
  IconTrash,
  IconUsersPlus,
  IconArrowsExchange,
} from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { getDeviceStatusUI } from "@/lib/device-status-ui";
import { getDeviceStatus, type DeviceStatusValue } from "@shared/device-statuses";
import type { DeviceDetailResponse, DeviceHealthInfo } from "@/lib/api";
import { Section, Card, Badge, ListLoading, EmptyState, Tabs, Tab, TabPanel, Text, Button, ConfirmDialog, IconButton } from "@/components/ui";
import { PageError, ActivityFeed } from "@/modules/shared/components";
import { DeviceForm } from "./device-form";
import { DeviceUsersTab } from "./device-users-tab";
import { DeviceHealthCards } from "./device-health-cards";
import { DeviceInfoTab } from "./device-info-tab";
import { DeviceActionsMenu } from "./device-actions-menu";
import { EnrollEmployeeDialog } from "./enroll-employee-dialog";
import { DeviceToDeviceCopyDialog } from "./device-to-device-copy-dialog";
import { UserSyncActions } from "./user-sync-actions";
import { useDeleteDevice } from "../hooks/use-delete-device";
import { useDeviceEvents, type DeviceEvent } from "../hooks/use-device-events";
import { mapEventKind } from "../utils/device-detail-utils";

import styles from "./device-detail-view.module.scss";

// ── Tab value constants ─────────────────────────────────────────────────

const TAB_INFO = "info";
const TAB_CONFIG = "config";
const TAB_USERS = "users";

// ── Types ────────────────────────────────────────────────────────────────

export type DeviceActivityEvent = {
  id: string;
  label: string;
  timestamp: number;
  kind: "online" | "offline" | "sync" | "warning" | "config" | "provision";
  isProblem?: boolean;
};

type DeviceDetailViewProps = {
  device: DeviceDetailResponse | undefined;
  deviceHealth?: DeviceHealthInfo | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
};

/**
 * Device detail view — full-page content for a single biometric scanner.
 *
 * Composes exclusively from existing UI primitives. Pure logic is extracted
 * into `device-detail-utils.ts` for testability. Enhanced with device actions
 * menu, enrollment dialog, and device-to-device copy.
 */
export function DeviceDetailView({
  device,
  deviceHealth,
  isLoading,
  error,
  onRetry,
}: DeviceDetailViewProps) {
  const { _ } = useLingui();

  // ── Hooks (must be called unconditionally — before any early return) ──

  const deleteMutation = useDeleteDevice();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const { data: rawEvents } = useDeviceEvents(device?.serial_number ?? "");
  const activityEvents: DeviceActivityEvent[] | undefined = rawEvents?.map(
    (e: DeviceEvent): DeviceActivityEvent => ({
      id: e.id,
      label: e.label,
      timestamp: e.timestamp,
      kind: mapEventKind(e.event_type),
      isProblem: e.is_problem,
    }),
  );

  // ── States ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <Section>
        <PageError onRetry={onRetry} message={_(msg`Could not load device information.`)} />
      </Section>
    );
  }

  if (isLoading) {
    return <ListLoading />;
  }

  if (!device) {
    return (
      <Section>
        <EmptyState
          title={_(msg`Device not found`)}
          description={_(msg`This device may have been removed or the serial number is incorrect.`)}
          action={
            <Button to={AppRoute.devices.list} variant="secondary">
              {_(msg`Back to Devices`)}
            </Button>
          }
        />
      </Section>
    );
  }

  // ── Derived data ───────────────────────────────────────────────────

  const statusValue: DeviceStatusValue = device.status ?? "offline";
  const statusDef = getDeviceStatus(statusValue);
  const statusUI = getDeviceStatusUI(statusValue);

  const hasCapacityData = device.user_capacity > 0 || device.record_capacity > 0;

  return (
    <>
      {/* Status + serial number + actions */}
      <Section className={styles.statusRow}>
        <Badge variant={statusUI.variant} dot={statusUI.dotColor} size="md">
          {statusDef?.label ?? statusValue}
        </Badge>
        <Text variant="caption" color="tertiary">
          {_(msg`SN: ${device.serial_number}`)}
        </Text>
        <DeviceActionsMenu deviceSn={device.serial_number} onRefresh={onRetry} />
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

      {/* Tabs: Info | Config | Users */}
      <Section>
        <Card>
          <Card.Content>
            <Tabs defaultValue={TAB_INFO}>
              <Tab value={TAB_INFO}>
                <IconInfoCircle size={16} />
                {_(msg`Device Info`)}
              </Tab>
              <Tab value={TAB_CONFIG}>
                <IconSettings size={16} />
                {_(msg`Config`)}
              </Tab>
              <Tab value={TAB_USERS}>
                <IconUserCircle size={16} />
                {_(msg`Users on Device`)}
              </Tab>

              <TabPanel value={TAB_INFO}>
                <DeviceInfoTab device={device} deviceHealth={deviceHealth} />
              </TabPanel>

              <TabPanel value={TAB_CONFIG}>
                <DeviceForm embedded onSaved={onRetry} />
              </TabPanel>

              <TabPanel value={TAB_USERS}>
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
              </TabPanel>
            </Tabs>
          </Card.Content>
        </Card>
      </Section>

      {/* Delete confirmation */}
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

      {/* Enrollment dialog */}
      <EnrollEmployeeDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        deviceSn={device.serial_number}
      />

      {/* Device-to-device copy dialog */}
      <DeviceToDeviceCopyDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        targetSn={device.serial_number}
      />
    </>
  );
}
