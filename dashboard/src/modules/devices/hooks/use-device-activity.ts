import { useQuery } from "@tanstack/react-query";
import { fetchDeviceActivity, type DeviceActivityEvent } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

/**
 * Paginated device activity feed hook.
 *
 * Fetches the merged device events + audit log for a device,
 * returning a typed activity feed suitable for timeline display.
 */
export function useDeviceActivity(deviceSn: string) {
  return useQuery({
    queryKey: QueryKeys.devices.activity(deviceSn),
    queryFn: () => fetchDeviceActivity(deviceSn, DEFAULT_PAGE_SIZE),
    enabled: deviceSn.length > 0,
    staleTime: 15_000,
    select: (page) => ({
      events: page.events as DeviceActivityEvent[],
      hasMore: page.has_more,
      nextCursor: page.next_cursor ?? null,
      isEmpty: page.events.length === 0,
    }),
  });
}
