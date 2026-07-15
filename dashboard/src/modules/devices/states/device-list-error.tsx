import { ListError } from "@/modules/shared/components";
type DeviceListErrorProps = {
  onRetry: () => void;
};

/**
 * Error state for the device list — query failed or network error.
 *
 * Renders a `PageError` with a context-specific message and retry button.
 * Use as the `errorFallback` prop of `DataBoundary`.
 */
export function DeviceListError({ onRetry }: DeviceListErrorProps) {
  return <ListError resource="devices" onRetry={onRetry} />;
}
