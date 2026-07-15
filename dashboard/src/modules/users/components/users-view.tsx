import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconTable } from "@tabler/icons-react";

import { useUsersPage } from "../hooks/use-users-page";
import { UserForm } from "./user-form";
import { ChangePasswordDialog } from "./change-password-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";
import { Section, Button, Dialog as DialogComponent, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView } from "@/modules/data-renderer";
import type { DashboardUser } from "@/lib/api";

/**
 * Users view — schema-driven table via {@link DataListView}.
 *
 * Uses `DataListView` for consistent toolbar + table layout.
 * Columns are defined in `useUsersPage` hook with custom `render` for badges and actions.
 * Dialogs (create/edit, delete, password) live outside the DataListView boundary.
 */
export function UsersView() {
  const { _ } = useLingui();
  const page = useUsersPage();

  const [search, setSearch] = useState("");

  // ── Client-side search ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = page.users;
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.display_name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [page.users, search]);

  const hasActiveFilters = search.length > 0;

  const handleClearFilters = useCallback(() => setSearch(""), []);

  const viewOptions = useMemo(
    () => [
      {
        value: "table" as const,
        label: _(msg`Table`),
        icon: <IconTable size={14} />,
      },
    ],
    [_],
  );

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
        <DataListView<DashboardUser>
          entity="user"
          columns={page.columns}
          data={filtered}
          getRowKey={(u) => u.id}
          isLoading={page.query.isLoading}
          error={page.query.error?.message ?? null}
          onRetry={() => page.query.refetch()}
          searchPlaceholder={_(msg`Search by username or display name…`)}
          searchValue={search}
          onSearchChange={setSearch}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          viewOptions={viewOptions}
          currentView="table"
          onViewChange={() => {}}
          resultCount={filtered.length}
          emptyState={
            page.users.length > 0 ? (
              <EmptyState
                title={_(msg`No users match`)}
                description={_(msg`Try adjusting or clearing your search.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No users`)}
                description={_(msg`Add your first dashboard user to get started.`)}
              />
            )
          }
        />
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
