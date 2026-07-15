import { ListError } from "@/modules/shared/components";
type ActivityErrorProps = {
  onRetry: () => void;
};

/**
 * Activity feed error state — retry button for failed activity fetch.
 */
export function ActivityError({ onRetry }: ActivityErrorProps) {
  return <ListError resource="device activity" onRetry={onRetry} />;
}
