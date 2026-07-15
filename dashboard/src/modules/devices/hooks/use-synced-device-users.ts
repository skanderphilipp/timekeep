import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/query-keys";
import { getSyncedDeviceUsers } from "@/lib/api";

/**
 * Fetch users synced from a specific device (from the local database).
 *
 * These users were synced at startup by `sync_users_to_storage()`.
 * The data is available even when the device is offline.
 */
export function useSyncedDeviceUsers(deviceSn: string) {
  return useQuery({
    queryKey: QueryKeys.devices.syncedUsers(deviceSn),
    queryFn: () => getSyncedDeviceUsers(deviceSn),
    enabled: deviceSn.length > 0,
    staleTime: 60_000, // 1 min — device users rarely change
  });
}
