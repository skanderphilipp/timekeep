/**
 * Action factories per entity type.
 *
 * Each factory receives an {@link ActionFactoryContext} with hooks
 * (i18n, toast, navigation, query client) and returns a list of
 * fully-formed {@link RecordAction} objects.
 *
 * Migrated from use-record-actions.ts — the switch statement that
 * grouped all entity action creation in one place. Now each entity
 * owns its own actions, and the entity definition registry wires
 * the correct factory.
 *
 * Architecture: timekeep/.notes/architecture/record-detail-enterprise-plan.md
 */
import { msg } from "@lingui/core/macro";
import {
  IconTrash,
  IconCopy,
  IconClock,
  IconCloudUpload,
  IconRefresh,
  IconFingerprint,
  IconCloudOff,
  IconUserOff,
  IconKey,
} from "@tabler/icons-react";

import type { ActionFactory, ActionFactoryContext } from "./types";
import { AppRoute } from "@/lib/navigation";
import { QueryKeys } from "@/lib/query-keys";

// ── API imports ────────────────────────────────────────────────────────
import {
  syncDeviceClock,
  resyncDevice,
  deleteDevice,
  restartDevice,
  syncEmployeeToDevices,
  removeEmployeeFromDevices,
} from "@/lib/api/devices";
import { deactivateEmployee } from "@/lib/api/employees";
import { deleteDepartment } from "@/lib/api/departments";
import { deleteDeviceGroup, syncDeviceGroup } from "@/lib/api/device-groups";
import { revokeApiKey } from "@/lib/api/apikeys";

// ── Helpers ────────────────────────────────────────────────────────────

function copyIdHandler(entityId: string, ctx: ActionFactoryContext) {
  return async () => {
    try {
      await navigator.clipboard.writeText(entityId);
      ctx.toast.success(ctx._(msg`ID copied to clipboard`));
    } catch {
      ctx.toast.error(ctx._(msg`Failed to copy`));
    }
  };
}

// ── Device Actions ─────────────────────────────────────────────────────

export const deviceActionFactory: ActionFactory = (ctx) => {
  const sn = ctx.entityId;
  return [
    {
      id: "device-sync-clock",
      label: ctx._(msg`Sync Clock`),
      icon: IconClock,
      placement: "header",
      variant: "secondary",
      action: async () => {
        try {
          await syncDeviceClock(sn);
          ctx.toast.success(ctx._(msg`Clock synced`));
        } catch {
          ctx.toast.error(ctx._(msg`Sync failed`));
        }
      },
    },
    {
      id: "device-resync",
      label: ctx._(msg`Full Re-sync`),
      icon: IconCloudUpload,
      placement: "footer",
      variant: "secondary",
      action: async () => {
        try {
          await resyncDevice(sn);
          ctx.toast.success(ctx._(msg`Re-sync started`));
        } catch {
          ctx.toast.error(ctx._(msg`Re-sync failed`));
        }
      },
    },
    {
      id: "device-restart",
      label: ctx._(msg`Restart`),
      icon: IconRefresh,
      placement: "footer",
      variant: "secondary",
      confirm: {
        title: ctx._(msg`Restart Device`),
        message: ctx._(
          msg`Are you sure you want to restart this device? It will be temporarily unavailable.`,
        ),
      },
      action: async () => {
        try {
          await restartDevice(sn);
          ctx.toast.success(ctx._(msg`Restart command sent`));
        } catch {
          ctx.toast.error(ctx._(msg`Restart failed`));
        }
      },
    },
    {
      id: "device-view-punches",
      label: ctx._(msg`View Punches`),
      icon: IconFingerprint,
      placement: "footer",
      variant: "ghost",
      action: async () => {
        ctx.navigate(AppRoute.attendance.byDevice(sn));
      },
    },
    {
      id: "device-copy-id",
      label: ctx._(msg`Copy Serial`),
      icon: IconCopy,
      placement: "footer",
      variant: "ghost",
      action: copyIdHandler(sn, ctx),
    },
    {
      id: "device-delete",
      label: ctx._(msg`Delete Device`),
      icon: IconTrash,
      placement: "footer",
      variant: "danger",
      confirm: {
        title: ctx._(msg`Delete Device`),
        message: ctx._(
          msg`This will permanently remove the device and all its data.`,
        ),
      },
      action: async () => {
        try {
          await deleteDevice(sn);
          ctx.toast.success(ctx._(msg`Device deleted`));
          ctx.invalidateQueries(QueryKeys.devices.all);
          ctx.navigate(AppRoute.devices.list);
        } catch {
          ctx.toast.error(ctx._(msg`Delete failed`));
        }
      },
    },
  ];
};

// ── Employee Actions ───────────────────────────────────────────────────

export const employeeActionFactory: ActionFactory = (ctx) => {
  const id = ctx.entityId;
  return [
    {
      id: "employee-sync-devices",
      label: ctx._(msg`Sync to Devices`),
      icon: IconCloudUpload,
      placement: "header",
      variant: "secondary",
      action: async () => {
        try {
          await syncEmployeeToDevices(id);
          ctx.toast.success(ctx._(msg`Sync started`));
        } catch {
          ctx.toast.error(ctx._(msg`Sync failed`));
        }
      },
    },
    {
      id: "employee-remove-devices",
      label: ctx._(msg`Remove from Devices`),
      icon: IconCloudOff,
      placement: "footer",
      variant: "secondary",
      confirm: {
        title: ctx._(msg`Remove from Devices`),
        message: ctx._(
          msg`Remove this employee from all enrolled devices? They will no longer be able to clock in.`,
        ),
      },
      action: async () => {
        try {
          await removeEmployeeFromDevices(id);
          ctx.toast.success(ctx._(msg`Removed from devices`));
        } catch {
          ctx.toast.error(ctx._(msg`Removal failed`));
        }
      },
    },
    {
      id: "employee-view-attendance",
      label: ctx._(msg`View Attendance`),
      icon: IconFingerprint,
      placement: "footer",
      variant: "ghost",
      action: async () => {
        ctx.navigate(AppRoute.attendance.list);
      },
    },
    {
      id: "employee-copy-id",
      label: ctx._(msg`Copy ID`),
      icon: IconCopy,
      placement: "footer",
      variant: "ghost",
      action: copyIdHandler(id, ctx),
    },
    {
      id: "employee-deactivate",
      label: ctx._(msg`Deactivate`),
      icon: IconUserOff,
      placement: "footer",
      variant: "danger",
      confirm: {
        title: ctx._(msg`Deactivate Employee`),
        message: ctx._(
          msg`This will deactivate the employee. They will no longer be able to clock in. This can be undone by an admin.`,
        ),
      },
      action: async () => {
        try {
          await deactivateEmployee(id);
          ctx.toast.success(ctx._(msg`Employee deactivated`));
          ctx.invalidateQueries(QueryKeys.employees.all);
          ctx.navigate(AppRoute.employees.list);
        } catch {
          ctx.toast.error(ctx._(msg`Deactivation failed`));
        }
      },
    },
  ];
};

// ── Department Actions ─────────────────────────────────────────────────

export const departmentActionFactory: ActionFactory = (ctx) => {
  const id = ctx.entityId;
  return [
    {
      id: "department-copy-id",
      label: ctx._(msg`Copy ID`),
      icon: IconCopy,
      placement: "footer",
      variant: "ghost",
      action: copyIdHandler(id, ctx),
    },
    {
      id: "department-delete",
      label: ctx._(msg`Delete Department`),
      icon: IconTrash,
      placement: "footer",
      variant: "danger",
      confirm: {
        title: ctx._(msg`Delete Department`),
        message: ctx._(
          msg`Employees in this department will lose their department assignment. Their data is preserved.`,
        ),
      },
      action: async () => {
        try {
          await deleteDepartment(id);
          ctx.toast.success(ctx._(msg`Department deleted`));
          ctx.invalidateQueries(["departments"]);
          ctx.navigate(AppRoute.departments.list);
        } catch {
          ctx.toast.error(ctx._(msg`Delete failed`));
        }
      },
    },
  ];
};

// ── Device Group Actions ───────────────────────────────────────────────

export const deviceGroupActionFactory: ActionFactory = (ctx) => {
  const id = ctx.entityId;
  return [
    {
      id: "device-group-sync",
      label: ctx._(msg`Sync Group`),
      icon: IconCloudUpload,
      placement: "header",
      variant: "secondary",
      /**
       * TODO(ENTERPRISE): Open department picker before syncing.
       *
       * Phase: Device Groups Phase 2
       * Impact: Currently syncs ALL employees without department filter.
       *         User story 2.2 requires department-scoped sync.
       * Fix: Show a dialog with a department Combobox before calling syncDeviceGroup(id, dept).
       */
      action: async () => {
        try {
          await syncDeviceGroup(id);
          ctx.toast.success(ctx._(msg`Group sync started`));
        } catch {
          ctx.toast.error(ctx._(msg`Sync failed`));
        }
      },
    },
    {
      id: "device-group-copy-id",
      label: ctx._(msg`Copy ID`),
      icon: IconCopy,
      placement: "footer",
      variant: "ghost",
      action: copyIdHandler(id, ctx),
    },
    {
      id: "device-group-delete",
      label: ctx._(msg`Delete Group`),
      icon: IconTrash,
      placement: "footer",
      variant: "danger",
      confirm: {
        title: ctx._(msg`Delete Device Group`),
        message: ctx._(
          msg`Deleting this group will NOT delete the devices in it. They will simply be ungrouped.`,
        ),
      },
      action: async () => {
        try {
          await deleteDeviceGroup(id);
          ctx.toast.success(ctx._(msg`Group deleted`));
          ctx.invalidateQueries(["device-groups"]);
          ctx.navigate(AppRoute.devices.groups);
        } catch {
          ctx.toast.error(ctx._(msg`Delete failed`));
        }
      },
    },
  ];
};

// ── API Key Actions ────────────────────────────────────────────────────

export const apiKeyActionFactory: ActionFactory = (ctx) => {
  const id = ctx.entityId;
  return [
    {
      id: "apikey-copy-id",
      label: ctx._(msg`Copy Key ID`),
      icon: IconCopy,
      placement: "footer",
      variant: "ghost",
      action: copyIdHandler(id, ctx),
    },
    {
      id: "apikey-revoke",
      label: ctx._(msg`Revoke Key`),
      icon: IconKey,
      placement: "footer",
      variant: "danger",
      confirm: {
        title: ctx._(msg`Revoke API Key`),
        message: ctx._(
          msg`This key will be permanently revoked. Any integrations using this key will stop working immediately.`,
        ),
      },
      action: async () => {
        try {
          await revokeApiKey(id);
          ctx.toast.success(ctx._(msg`Key revoked`));
          ctx.invalidateQueries(["api-keys"]);
        } catch {
          ctx.toast.error(ctx._(msg`Revoke failed`));
        }
      },
    },
  ];
};

// ── Default (copy ID only) ─────────────────────────────────────────────

export const defaultActionFactory: ActionFactory = (ctx) => {
  return [
    {
      id: "copy-id",
      label: ctx._(msg`Copy ID`),
      icon: IconCopy,
      placement: "footer",
      variant: "ghost",
      action: copyIdHandler(ctx.entityId, ctx),
    },
  ];
};
