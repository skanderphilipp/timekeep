import { useQuery } from "@tanstack/react-query";

import {
  fetchDeviceDetail,
  fetchHealth,
  type DeviceDetailResponse,
  type DeviceHealthInfo,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { SETTINGS_STALE_TIME_MS } from "@/lib/constants";

/**
 * Device detail query hook — enriched edition.
 *
 * Fetches the full `DeviceDetailResponse` (with model, firmware, platform,
 * MAC, fingerprint/face counts, capacity, sync status) and cross-references
 * with the health endpoint for live connection status.
 */
export function useDeviceDetail(sn: string) {
  const deviceQuery = useQuery({
    queryKey: QueryKeys.devices.detailEnriched(sn),
    queryFn: () => fetchDeviceDetail(sn),
    enabled: !!sn,
    refetchInterval: 15_000, // 15s — pick up connection status changes
  });

  const healthQuery = useQuery({
    queryKey: QueryKeys.health.system(),
    queryFn: fetchHealth,
    staleTime: SETTINGS_STALE_TIME_MS,
  });

  const device: DeviceDetailResponse | undefined = deviceQuery.data;
  const deviceHealth: DeviceHealthInfo | undefined = healthQuery.data?.devices?.find(
    (d) => d.serial_number === sn,
  );

  return {
    device,
    deviceHealth,
    isLoading: deviceQuery.isLoading,
    error: deviceQuery.error,
    refetch: deviceQuery.refetch,
  } as const;
}
