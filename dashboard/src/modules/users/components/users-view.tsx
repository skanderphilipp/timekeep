import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { useUsersPage } from "../hooks/use-users-page";
import { UserForm } from "./user-form";
import { ChangePasswordDialog } from "./change-password-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";
import { Section, DataTable, Button, Dialog as DialogComponent } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import type { DashboardUser } from "@/lib/api";
import { UserListLoading, UserListError, UserListEmpty } from "../states";

/**
 * Users view — user table, create/edit form, password + delete dialogs.
 *
 * Uses `DataBoundary` for the data pipeline (loading → error → empty → data).
 * UI state (form mode, dialogs) is managed via Jotai atoms so other components
 * (dashboard, side panel) can coordinate with user management.
 */
export function UsersView() {
  const { _ } = useLingui();
  const page = useUsersPage();

  return (
    <>
      <PageHeader
        title={_(msg`Users`)}
        description={_(msg`Manage dashboard users, roles, and passwords.`)}
        actions={
          !page.query.isLoading && !page.query.error ? (
            <Button size="sm" icon={<IconPlus size={16} />} onClick={page.handleCreate}>
              {_(msg`Add User`)}
            </Button>
          ) : undefined
        }
      />

      <Section>
        <DataBoundary<DashboardUser>
          data={page.query.data ? page.users : undefined}
          isLoading={page.query.isLoading}
          error={page.query.error ?? null}
          onRetry={() => page.query.refetch()}
          loadingFallback={<UserListLoading />}
          errorFallback={<UserListError onRetry={() => page.query.refetch()} />}
          emptyFallback={<UserListEmpty onCreateUser={page.handleCreate} />}
        >
          {(users) => <DataTable columns={page.columns} data={users} getRowKey={(u) => u.id} />}
        </DataBoundary>
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
        onCancel={() => page.closeDeleteDialog()}
        onConfirm={page.handleDelete}
      />

      {page.passwordUser && (
        <ChangePasswordDialog
          open={!!page.passwordUser}
          onClose={() => page.closePasswordDialog()}
          user={page.passwordUser}
          onSubmit={page.handlePasswordChange}
        />
      )}
    </>
  );
}
