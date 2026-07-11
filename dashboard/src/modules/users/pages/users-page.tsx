import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { useUsersPage } from "../hooks/use-users-page";
import { UserForm } from "../components/user-form";
import { ChangePasswordDialog } from "../components/change-password-dialog";
import {
  PageLayout,
  PageBody,
  PageHeader,
  Section,
  DataTable,
  Spinner,
  EmptyState,
  Button,
  Dialog as DialogComponent,
  FormActions,
  PageError,
} from "@/components/ui";

export function UsersPage() {
  const { _ } = useLingui();
  const page = useUsersPage();

  if (page.query.error) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader
            title={_(msg`Users`)}
            description={_(msg`Manage dashboard users, roles, and passwords.`)}
          />
          <PageError onRetry={() => page.query.refetch()} />
        </PageBody>
      </PageLayout>
    );
  }

  if (page.query.isLoading) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader title={_(msg`Users`)} description={_(msg`Manage dashboard users, roles, and passwords.`)} />
          <Section>
            <Spinner />
          </Section>
        </PageBody>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageBody>
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
              action={<Button icon={<IconPlus size={16} />} onClick={page.handleCreate}>{_(msg`Add User`)}</Button>}
            />
          ) : (
            <DataTable columns={page.columns} data={page.users} getRowKey={(u) => u.id} />
          )}
        </Section>

        <DialogComponent
          open={page.formMode !== "closed"}
          onOpenChange={(o) => { if (!o) page.handleCloseForm(); }}
          title={_(page.formMode === "create" ? msg`Create User` : msg`Edit User`)}
        >
          <UserForm user={page.editingUser} onSuccess={page.handleCloseForm} />
        </DialogComponent>

        <DialogComponent
          open={!!page.deletingUser}
          onOpenChange={(o) => { if (!o) page.setDeletingUser(undefined); }}
          title={_(msg`Delete User`)}
          description={_(msg`Are you sure you want to delete ${page.deletingUser?.username ?? ""}? This action cannot be undone.`)}
        >
          <FormActions>
            <Button variant="secondary" onClick={() => page.setDeletingUser(undefined)} disabled={page.deleteMutation.isPending}>
              {_(msg`Cancel`)}
            </Button>
            <Button variant="danger" onClick={page.handleDelete} loading={page.deleteMutation.isPending}>
              {_(msg`Delete`)}
            </Button>
          </FormActions>
        </DialogComponent>

        {page.passwordUser && (
          <ChangePasswordDialog
            open={!!page.passwordUser}
            onClose={() => page.setPasswordUser(undefined)}
            user={page.passwordUser}
            onSubmit={page.handlePasswordChange}
          />
        )}
      </PageBody>
    </PageLayout>
  );
}
