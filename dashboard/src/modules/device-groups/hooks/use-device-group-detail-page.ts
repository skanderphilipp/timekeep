import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { fetchDeviceGroup, fetchDevicesInGroup, type DeviceGroup } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Device Group detail page orchestration hook.
 *
 * Extracts route params, fetches group + devices, and derives
 * breadcrumb/page-bar values so the page component stays thin.
 */
export function useDeviceGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { _ } = useLingui();

  const groupQuery = useQuery<DeviceGroup>({
    queryKey: QueryKeys.deviceGroups.detail(id!),
    queryFn: () => fetchDeviceGroup(id!),
    enabled: !!id,
  });

  const devicesQuery = useQuery({
    queryKey: QueryKeys.deviceGroups.devices(id!),
    queryFn: () => fetchDevicesInGroup(id!),
    enabled: !!id,
  });

  const group = groupQuery.data;
  const title = group?.name || _(msg`Device Group`);
  const pageLabel = group?.name;

  return {
    id: id!,
    group,
    devices: devicesQuery.data ?? [],
    isLoading: groupQuery.isLoading,
    error: groupQuery.error,
    refetch: () => {
      groupQuery.refetch();
      devicesQuery.refetch();
    },
    title,
    pageLabel,
  } as const;
}
