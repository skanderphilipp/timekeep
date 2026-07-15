import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { EmptyState, Button } from "@/components/ui";

type UserListEmptyProps = {
  onCreateUser: () => void;
};

export function UserListEmpty({ onCreateUser }: UserListEmptyProps) {
  const { _ } = useLingui();

  return (
    <EmptyState
      title={_(msg`No users`)}
      description={_(msg`Create your first dashboard user to get started.`)}
      action={
        <Button icon={<IconPlus size={16} />} onClick={onCreateUser}>
          {_(msg`Add User`)}
        </Button>
      }
    />
  );
}
