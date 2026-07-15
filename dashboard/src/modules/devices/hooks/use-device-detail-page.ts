import { useParams } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useDeviceDetail } from "./use-device-detail";

/**
 * Device detail page orchestration hook.
 *
 * Extracts route params, fetches device data, and derives
 * breadcrumb/page-bar values so the page component stays thin.
 */
export function useDeviceDetailPage() {
  const { sn } = useParams<{ sn: string }>();
  const { device, deviceHealth, isLoading, error, refetch } = useDeviceDetail(sn!);
  const { _ } = useLingui();

  const title = device?.label || device?.serial_number || _(msg`Device`);
  const subtitle = device?.host ? `${device.host}:${device.port}` : undefined;
  const pageLabel = device?.label || device?.serial_number;

  return {
    sn: sn!,
    device,
    deviceHealth,
    isLoading,
    error,
    refetch,
    title,
    subtitle,
    pageLabel,
  } as const;
}
