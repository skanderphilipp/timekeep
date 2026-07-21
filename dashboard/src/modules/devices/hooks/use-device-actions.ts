import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  restartDevice,
  syncDeviceClock,
  pullAttendanceFromDevice,
  refreshDeviceInfo,
  refreshDeviceUsers,
  clearDeviceUsers as clearDeviceUsersApi,
  deleteDevice,
  enrollFinger,
  syncDeviceToDevice,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Unified device actions hook — the single source for ALL device operations.
 *
 * Replaces the previously scattered hooks:
 *   - useDeviceCommand (restart, syncClock, pullAttendance, refreshInfo, refreshUsers)
 *   - useDeviceCommands (ADMS push command queue)
 *   - useSyncActions (resync, syncFrom, syncEmployee, removeEmployee)
 *   - useDeleteDevice (delete)
 *
 * Every action is a TanStack mutation with proper loading states, cache
 * invalidation, and error propagation. Consumers (buttons, Cmd+K palette,
 * action factories) all call these mutations — no raw API calls elsewhere.
 *
 * ## Action Categories
 *
 * ### Category A — Direct Commands (immediate, no confirmation)
 * These give live feedback. The device responds right away. Use for polling
 * data and refreshing state.
 *   - pullAttendance    → pull attendance records from device now
 *   - refreshInfo       → pull device metadata (user count, storage, capacity)
 *   - refreshUsers      → pull live user list from device
 *
 * ### Category B — Device Control (needs confirmation for safety)
 * These modify device state and may cause temporary unavailability.
 *   - syncClock         → set device clock to server time
 *   - restart           → reboot physical device (~30s offline)
 *   - enrollFingerprint → start interactive fingerprint enrollment
 *
 * ### Category C — Destructive Data Operations (strong confirmation required)
 * These permanently delete data from the device.
 *   - clearDeviceUsers  → delete ALL users from the device
 *
 * ### Category D — Device Lifecycle
 *   - delete            → remove device registration from the system
 */
export function useDeviceActions(deviceSn: string) {
  const queryClient = useQueryClient();

  /** Invalidate all queries that show data for this device. */
  const invalidateDevice = () => {
    queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    queryClient.invalidateQueries({ queryKey: QueryKeys.devices.syncedUsers(deviceSn) });
    queryClient.invalidateQueries({ queryKey: QueryKeys.devices.enrollments(deviceSn) });
    queryClient.invalidateQueries({ queryKey: QueryKeys.health.system() });
  };

  // ── Category A: Direct Commands ──────────────────────────────────────

  const pullAttendance = useMutation({
    mutationFn: () => pullAttendanceFromDevice(deviceSn),
    onSuccess: invalidateDevice,
  });

  const refreshInfo = useMutation({
    mutationFn: () => refreshDeviceInfo(deviceSn),
    onSuccess: invalidateDevice,
  });

  const refreshUsers = useMutation({
    mutationFn: () => refreshDeviceUsers(deviceSn),
    onSuccess: invalidateDevice,
  });

  // ── Category B: Device Control ───────────────────────────────────────

  const syncClock = useMutation({
    mutationFn: () => syncDeviceClock(deviceSn),
    onSuccess: invalidateDevice,
  });

  const restart = useMutation({
    mutationFn: () => restartDevice(deviceSn),
    onSuccess: invalidateDevice,
  });

  const enrollFingerprint = useMutation({
    mutationFn: (pin: string) => enrollFinger(deviceSn, pin, 0),
    onSuccess: invalidateDevice,
  });

  // ── Category B.5: Device-to-Device ───────────────────────────────────

  /** Copy users from a source device to this device. Additive — does not clear users first. */
  const copyUsersFromDevice = useMutation({
    mutationFn: (sourceSn: string) => syncDeviceToDevice(deviceSn, sourceSn),
    onSuccess: invalidateDevice,
  });

  // ── Category C: Destructive Data Operations ──────────────────────────

  /**
   * Clear ALL users from the device.
   *
   * DESTRUCTIVE — deletes every user on the physical device.
   * Users can be restored by pushing employees back to the device.
   */
  const clearDeviceUsers = useMutation({
    mutationFn: () => clearDeviceUsersApi(deviceSn),
    onSuccess: () => {
      invalidateDevice();
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
    },
  });

  // ── Category D: Device Lifecycle ─────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => deleteDevice(deviceSn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    },
  });

  return {
    // Category A — Direct Commands (live feedback, no confirmation)
    pullAttendance,
    refreshInfo,
    refreshUsers,

    // Category B — Device Control (confirmation recommended)
    syncClock,
    restart,
    enrollFingerprint,
    copyUsersFromDevice,

    // Category C — Destructive (strong confirmation required)
    clearDeviceUsers,

    // Category D — Lifecycle
    delete: deleteMutation,

    // Shared utility
    invalidateDevice,
  } as const;
}
