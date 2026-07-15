import { ListError } from "@/modules/shared/components";
type EndpointListErrorProps = {
  onRetry: () => void;
};

export function EndpointListError({ onRetry }: EndpointListErrorProps) {
  return <ListError resource="endpoints" onRetry={onRetry} />;
}
