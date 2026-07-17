import { useCallback, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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

import type { EntityType } from "@/types/entities";
import type { RecordAction } from "../types";
import { useRecordDetailContext } from "../states/record-detail-context";
import { useToast } from "@/infrastructure/toast/toast";
import { AppRoute } from "@/lib/navigation";
import { QueryKeys } from "@/lib/query-keys";
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

type UseRecordActionsOptions = {
  entityType?: EntityType;
  entityId?: string;
};

/**
 * Returns entity-specific actions based on the current record.
 *
 * When called inside `<RecordDetailProvider>`, reads entityType/entityId from context.
 * When called outside (SidePanelShell), pass explicit params from nav stack.
 */
export function useRecordActions(options?: UseRecordActionsOptions): RecordAction[] {
  const { _ } = useLingui();
  const ctx = useRecordDetailContextSafe();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const entityType = options?.entityType ?? ctx?.entityType ?? ("device" as EntityType);
  const entityId = options?.entityId ?? ctx?.entityId ?? "";
  const isNewRecord = entityId.length === 0;

  // ── Copy ID (shared) ────────────────────────────────────────────────

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(entityId);
      toast.success(_(msg`ID copied to clipboard`));
    } catch {
      toast.error(_(msg`Failed to copy`));
    }
  }, [entityId, toast, _]);

  // ── Device ──────────────────────────────────────────────────────────

  const deviceActions = useMemo((): RecordAction[] => {
    if (entityType !== "device") return [];
    const sn = entityId;
    return [
      {
        id: "device-sync-clock",
        label: _(msg`Sync Clock`),
        icon: IconClock,
        placement: "header",
        variant: "secondary",
        action: async () => {
          try { await syncDeviceClock(sn); toast.success(_(msg`Clock synced`)); }
          catch { toast.error(_(msg`Sync failed`)); }
        },
      },
      {
        id: "device-resync",
        label: _(msg`Full Re-sync`),
        icon: IconCloudUpload,
        placement: "footer",
        variant: "secondary",
        action: async () => {
          try { await resyncDevice(sn); toast.success(_(msg`Re-sync started`)); }
          catch { toast.error(_(msg`Re-sync failed`)); }
        },
      },
      {
        id: "device-restart",
        label: _(msg`Restart`),
        icon: IconRefresh,
        placement: "footer",
        variant: "secondary",
        confirm: {
          title: _(msg`Restart Device`),
          message: _(msg`Are you sure you want to restart this device? It will be temporarily unavailable.`),
        },
        action: async () => {
          try { await restartDevice(sn); toast.success(_(msg`Restart command sent`)); }
          catch { toast.error(_(msg`Restart failed`)); }
        },
      },
      {
        id: "device-view-punches",
        label: _(msg`View Punches`),
        icon: IconFingerprint,
        placement: "footer",
        variant: "ghost",
        action: async () => { navigate(AppRoute.attendance.byDevice(sn)); },
      },
      {
        id: "device-copy-id",
        label: _(msg`Copy Serial`),
        icon: IconCopy,
        placement: "footer",
        variant: "ghost",
        action: handleCopyId,
      },
      {
        id: "device-delete",
        label: _(msg`Delete Device`),
        icon: IconTrash,
        placement: "footer",
        variant: "danger",
        confirm: {
          title: _(msg`Delete Device`),
          message: _(msg`This will permanently remove the device and all its data.`),
        },
        action: async () => {
          try {
            await deleteDevice(sn);
            toast.success(_(msg`Device deleted`));
            queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
            navigate(AppRoute.devices.list);
          } catch { toast.error(_(msg`Delete failed`)); }
        },
      },
    ];
  }, [entityType, entityId, handleCopyId, _, navigate, toast, queryClient]);

  // ── Employee ────────────────────────────────────────────────────────

  const employeeActions = useMemo((): RecordAction[] => {
    if (entityType !== "employee") return [];
    const id = entityId;
    return [
      {
        id: "employee-sync-devices",
        label: _(msg`Sync to Devices`),
        icon: IconCloudUpload,
        placement: "header",
        variant: "secondary",
        action: async () => {
          try { await syncEmployeeToDevices(id); toast.success(_(msg`Sync started`)); }
          catch { toast.error(_(msg`Sync failed`)); }
        },
      },
      {
        id: "employee-remove-devices",
        label: _(msg`Remove from Devices`),
        icon: IconCloudOff,
        placement: "footer",
        variant: "secondary",
        confirm: {
          title: _(msg`Remove from Devices`),
          message: _(msg`Remove this employee from all enrolled devices? They will no longer be able to clock in.`),
        },
        action: async () => {
          try { await removeEmployeeFromDevices(id); toast.success(_(msg`Removed from devices`)); }
          catch { toast.error(_(msg`Removal failed`)); }
        },
      },
      {
        id: "employee-view-attendance",
        label: _(msg`View Attendance`),
        icon: IconFingerprint,
        placement: "footer",
        variant: "ghost",
        action: async () => { navigate(AppRoute.attendance.list); },
      },
      {
        id: "employee-copy-id",
        label: _(msg`Copy ID`),
        icon: IconCopy,
        placement: "footer",
        variant: "ghost",
        action: handleCopyId,
      },
      {
        id: "employee-deactivate",
        label: _(msg`Deactivate`),
        icon: IconUserOff,
        placement: "footer",
        variant: "danger",
        confirm: {
          title: _(msg`Deactivate Employee`),
          message: _(msg`This will deactivate the employee. They will no longer be able to clock in. This can be undone by an admin.`),
        },
        action: async () => {
          try {
            await deactivateEmployee(id);
            toast.success(_(msg`Employee deactivated`));
            queryClient.invalidateQueries({ queryKey: QueryKeys.employees.all });
            navigate(AppRoute.employees.list);
          } catch { toast.error(_(msg`Deactivation failed`)); }
        },
      },
    ];
  }, [entityType, entityId, handleCopyId, _, navigate, toast, queryClient]);

  // ── Department ──────────────────────────────────────────────────────
  // User story: HR manages departments, needs delete/copy.

  const departmentActions = useMemo((): RecordAction[] => {
    if (entityType !== "department") return [];
    const id = entityId;
    return [
      {
        id: "department-copy-id",
        label: _(msg`Copy ID`),
        icon: IconCopy,
        placement: "footer",
        variant: "ghost",
        action: handleCopyId,
      },
      {
        id: "department-delete",
        label: _(msg`Delete Department`),
        icon: IconTrash,
        placement: "footer",
        variant: "danger",
        confirm: {
          title: _(msg`Delete Department`),
          message: _(msg`Employees in this department will lose their department assignment. Their data is preserved.`),
        },
        action: async () => {
          try {
            await deleteDepartment(id);
            toast.success(_(msg`Department deleted`));
            queryClient.invalidateQueries({ queryKey: ["departments"] });
            navigate(AppRoute.departments.list);
          } catch { toast.error(_(msg`Delete failed`)); }
        },
      },
    ];
  }, [entityType, entityId, handleCopyId, _, navigate, toast, queryClient]);

  // ── Device Group ────────────────────────────────────────────────────
  // User story: HR syncs employees to device groups.

  const deviceGroupActions = useMemo((): RecordAction[] => {
    if (entityType !== "device_group") return [];
    const id = entityId;
    return [
      {
        id: "device-group-sync",
        label: _(msg`Sync Group`),
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
            toast.success(_(msg`Group sync started`));
          } catch { toast.error(_(msg`Sync failed`)); }
        },
      },
      {
        id: "device-group-copy-id",
        label: _(msg`Copy ID`),
        icon: IconCopy,
        placement: "footer",
        variant: "ghost",
        action: handleCopyId,
      },
      {
        id: "device-group-delete",
        label: _(msg`Delete Group`),
        icon: IconTrash,
        placement: "footer",
        variant: "danger",
        confirm: {
          title: _(msg`Delete Device Group`),
          message: _(msg`Deleting this group will NOT delete the devices in it. They will simply be ungrouped.`),
        },
        action: async () => {
          try {
            await deleteDeviceGroup(id);
            toast.success(_(msg`Group deleted`));
            queryClient.invalidateQueries({ queryKey: ["device-groups"] });
            navigate(AppRoute.devices.groups);
          } catch { toast.error(_(msg`Delete failed`)); }
        },
      },
    ];
  }, [entityType, entityId, handleCopyId, _, navigate, toast, queryClient]);

  // ── API Key ─────────────────────────────────────────────────────────

  const apiKeyActions = useMemo((): RecordAction[] => {
    if (entityType !== "api_key") return [];
    const id = entityId;
    return [
      {
        id: "apikey-copy-id",
        label: _(msg`Copy Key ID`),
        icon: IconCopy,
        placement: "footer",
        variant: "ghost",
        action: handleCopyId,
      },
      {
        id: "apikey-revoke",
        label: _(msg`Revoke Key`),
        icon: IconKey,
        placement: "footer",
        variant: "danger",
        confirm: {
          title: _(msg`Revoke API Key`),
          message: _(msg`This key will be permanently revoked. Any integrations using this key will stop working immediately.`),
        },
        action: async () => {
          try {
            await revokeApiKey(id);
            toast.success(_(msg`Key revoked`));
            queryClient.invalidateQueries({ queryKey: ["api-keys"] });
          } catch { toast.error(_(msg`Revoke failed`)); }
        },
      },
    ];
  }, [entityType, entityId, handleCopyId, _, toast, queryClient]);

  // ── Aggregation ─────────────────────────────────────────────────────

  return useMemo(() => {
    if (isNewRecord) return [];

    switch (entityType) {
      case "device":       return deviceActions;
      case "employee":     return employeeActions;
      case "department":   return departmentActions;
      case "device_group": return deviceGroupActions;
      case "api_key":      return apiKeyActions;
      default:
        return [
          {
            id: "copy-id",
            label: _(msg`Copy ID`),
            icon: IconCopy,
            placement: "footer",
            variant: "ghost",
            action: handleCopyId,
          },
        ];
    }
  }, [entityType, isNewRecord, deviceActions, employeeActions, departmentActions, deviceGroupActions, apiKeyActions, handleCopyId, _]);
}

/** Safe context read — returns null when called outside RecordDetailProvider. */
function useRecordDetailContextSafe() {
  try { return useRecordDetailContext(); }
  catch { return null; }
}
