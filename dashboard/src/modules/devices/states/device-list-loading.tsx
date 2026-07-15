import { ListLoading } from "@/components/ui";

/**
 * Loading state for the device list — shown during initial fetch.
 *
 * Renders a centered spinner. Use as the `loadingFallback` prop of `DataBoundary`.
 * No i18n needed — this is a purely visual loading indicator.
 */
export function DeviceListLoading() {
  return <ListLoading />;
}
