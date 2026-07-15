import { useParams } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { PageBar, PageLayout, PageBody } from "@/components/layout";
import { DeviceDetailView } from "../components/device-detail-view";
import { useDeviceDetail } from "../hooks/use-device-detail";

/**
 * Device detail page — thin composite.
 *
 * Owns the page layout: `PageLayout > PageBar > PageBody`.
 * Delegates all content to {@link DeviceDetailView}.
 * The page only extracts the `sn` param and wires the hook to the view.
 *
 * Device stats and activity events are now fetched internally by
 * DeviceDetailView via `useDeviceEvents` and the enriched
 * `GET /api/devices/{sn}` response.
 */
export function DeviceDetailPage() {
  const { sn } = useParams<{ sn: string }>();
  const { device, deviceHealth, isLoading, error, refetch } = useDeviceDetail(sn!);
  const { _ } = useLingui();

  const title = device?.label || device?.serial_number || _(msg`Device`);
  const subtitle = device?.host ? `${device.host}:${device.port}` : undefined;

  return (
    <PageLayout>
      <PageBar
        title={title}
        description={subtitle}
        breadcrumbs={[
          { label: _(msg`Devices`), path: AppRoute.devices.list },
          { label: title, path: AppRoute.devices.detail(sn!) },
        ]}
      />
      <PageBody>
        <DeviceDetailView
          device={device}
          deviceHealth={deviceHealth ?? null}
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
      </PageBody>
    </PageLayout>
  );
}
