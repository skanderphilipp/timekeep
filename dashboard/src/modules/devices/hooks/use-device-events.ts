import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/query-keys";
import { apiGet } from "@/lib/api-client";

/** Matches the Rust `DeviceEventResponse` DTO. */
export type DeviceEvent = {
  id: string;
  device_sn: string;
  timestamp: number;
  event_type: string;
  label: string;
  is_problem: boolean;
};

/**
 * Fetch the activity timeline events for a specific device.
 */
export function useDeviceEvents(deviceSn: string) {
  return useQuery({
    queryKey: QueryKeys.devices.detail(deviceSn).concat(["events"]),
    queryFn: async () => {
      const resp = await apiGet<DeviceEvent[]>(`devices/${encodeURIComponent(deviceSn)}/events`);
      return resp.json();
    },
    enabled: deviceSn.length > 0,
    staleTime: 30_000, // 30s — events update frequently
  });
}
