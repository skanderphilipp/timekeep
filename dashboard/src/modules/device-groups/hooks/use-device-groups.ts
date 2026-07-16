import { useQuery } from "@tanstack/react-query";
import { fetchDeviceGroups, type DeviceGroup } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Device Group list hook — fetches all device groups.
 */
export function useDeviceGroups() {
  return useQuery<DeviceGroup[]>({
    queryKey: QueryKeys.deviceGroups.list(),
    queryFn: fetchDeviceGroups,
  });
}
