import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  resyncDevice,
  syncDeviceToDevice,
  syncEmployeeToDevices,
  removeEmployeeFromDevices,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Device sync action mutations.
 *
 * Provides fire-and-forget mutations for:
 * - Full device resync
 * - Device-to-device user copy
 * - Employee sync to all devices
 * - Employee removal from all devices
 *
 * Each mutation invalidates the relevant query keys on success.
 */
export function useSyncActions(deviceSn: string) {
  const queryClient = useQueryClient();

  const invalidateDevice = () => {
    queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    queryClient.invalidateQueries({ queryKey: QueryKeys.devices.syncedUsers(deviceSn) });
    queryClient.invalidateQueries({ queryKey: QueryKeys.devices.enrollments(deviceSn) });
  };

  const resyncMutation = useMutation({
    mutationFn: () => resyncDevice(deviceSn),
    onSuccess: invalidateDevice,
  });

  const syncFromMutation = useMutation({
    mutationFn: (sourceSn: string) => syncDeviceToDevice(deviceSn, sourceSn),
    onSuccess: invalidateDevice,
  });

  const syncEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => syncEmployeeToDevices(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
    },
  });

  const removeEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => removeEmployeeFromDevices(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
    },
  });

  return {
    resync: resyncMutation,
    syncFrom: syncFromMutation,
    syncEmployee: syncEmployeeMutation,
    removeEmployee: removeEmployeeMutation,
  } as const;
}
