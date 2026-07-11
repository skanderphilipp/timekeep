import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { useUsersPage } from "../hooks/use-users-page";
import { UserForm } from "./user-form";
import { ChangePasswordDialog } from "./change-password-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";
import {
  PageHeader,
  Section,
  DataTable,
  Spinner,
  EmptyState,
  Button,
  Dialog as DialogComponent,
  PageError,
} from "@/components/ui";

/**
 * Users view — user table, create/edit form, password + delete dialogs.
 *
 * Owns all page state via useUsersPage; the page composes this inside PageLayout.
 */
export function UsersView() {
  const { _ } = useLingui();
  const page = useUsersPage();

  if (page.query.error) {
    return (
      <>
        <PageHeader
          title={_(msg`Users`)}
          description={_(msg`Manage dashboard users, roles, and passwords.`)}
        />
        <PageError onRetry={() => page.query.refetch()} />
      </>
    );
  }

  if (page.query.isLoading) {
    return (
      <>
        <PageHeader
          title={_(msg`Users`)}
          description={_(msg`Manage dashboard users, roles, and passwords.`)}
        />
        <Section>
          <Spinner />
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={_(msg`Users`)}
        description={_(msg`Manage dashboard users, roles, and passwords.`)}
        actions={
          <Button size="sm" icon={<IconPlus size={16} />} onClick={page.handleCreate}>
            {_(msg`Add User`)}
          </Button>
        }
      />
      <Section>
        {page.users.length === 0 ? (
          <EmptyState
            title={_(msg`No users`)}
            description={_(msg`Create your first dashboard user to get started.`)}
            action={
              <Button icon={<IconPlus size={16} />} onClick={page.handleCreate}>
                {_(msg`Add User`)}
              </Button>
            }
          />
        ) : (
          <DataTable columns={page.columns} data={page.users} getRowKey={(u) => u.id} />
        )}
      </Section>

      <DialogComponent
        open={page.formMode !== "closed"}
        onOpenChange={(o) => {
          if (!o) page.handleCloseForm();
        }}
        title={_(page.formMode === "create" ? msg`Create User` : msg`Edit User`)}
      >
        <UserForm user={page.editingUser} onSuccess={page.handleCloseForm} />
      </DialogComponent>

      <DeleteUserDialog
        user={page.deletingUser}
        isPending={page.deleteMutation.isPending}
        onCancel={() => page.setDeletingUser(undefined)}
        onConfirm={page.handleDelete}
      />

      {page.passwordUser && (
        <ChangePasswordDialog
          open={!!page.passwordUser}
          onClose={() => page.setPasswordUser(undefined)}
          user={page.passwordUser}
          onSubmit={page.handlePasswordChange}
        />
      )}
    </>
  );
}
