import { ListError } from "@/modules/shared/components";
type UserListErrorProps = {
  onRetry: () => void;
};

export function UserListError({ onRetry }: UserListErrorProps) {
  return <ListError resource="users" onRetry={onRetry} />;
}
