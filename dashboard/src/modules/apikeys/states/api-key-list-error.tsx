import { ListError } from "@/modules/shared/components";
type ApiKeyListErrorProps = {
  onRetry: () => void;
};

export function ApiKeyListError({ onRetry }: ApiKeyListErrorProps) {
  return <ListError resource="API keys" onRetry={onRetry} />;
}
