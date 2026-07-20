import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  restartDevice,
  syncDeviceClock,
  pullAttendanceFromDevice,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Device command mutations (restart, sync clock, pull attendance).
 *
 * Provides fire-and-forget mutations for direct device operations.
 * Each invalidates device detail on success so the status refreshes.
 */
export function useDeviceCommand(deviceSn: string) {
  const queryClient = useQueryClient();

  const invalidateDevice = () => {
    queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    queryClient.invalidateQueries({ queryKey: QueryKeys.health.system() });
  };

  const restartMutation = useMutation({
    mutationFn: () => restartDevice(deviceSn),
    onSuccess: invalidateDevice,
  });

  const syncClockMutation = useMutation({
    mutationFn: () => syncDeviceClock(deviceSn),
    onSuccess: invalidateDevice,
  });

  const pullAttendanceMutation = useMutation({
    mutationFn: () => pullAttendanceFromDevice(deviceSn),
    onSuccess: invalidateDevice,
  });

  return {
    restart: restartMutation,
    syncClock: syncClockMutation,
    pullAttendance: pullAttendanceMutation,
  } as const;
}
