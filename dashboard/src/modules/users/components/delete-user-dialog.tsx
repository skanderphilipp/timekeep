import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Button, Dialog as DialogComponent, FormActions } from "@/components/ui";
import type { DashboardUser } from "@/lib/api";

type DeleteUserDialogProps = {
  user: DashboardUser | undefined;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirmation dialog for deleting a dashboard user.
 */
export function DeleteUserDialog({ user, isPending, onCancel, onConfirm }: DeleteUserDialogProps) {
  const { _ } = useLingui();

  return (
    <DialogComponent
      open={!!user}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={_(msg`Delete User`)}
      description={_(
        msg`Are you sure you want to delete ${user?.username ?? ""}? This action cannot be undone.`,
      )}
    >
      <FormActions>
        <Button variant="secondary" onClick={onCancel} disabled={isPending}>
          {_(msg`Cancel`)}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={isPending}>
          {_(msg`Delete`)}
        </Button>
      </FormActions>
    </DialogComponent>
  );
}
