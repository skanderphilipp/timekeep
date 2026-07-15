import { useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPencil, IconKey, IconTrash } from "@tabler/icons-react";
import { useAtomValue, useSetAtom } from "jotai";

import { Badge, IconButton, ActionGroup, type DataTableColumn } from "@/components/ui";
import { useToast } from "@/infrastructure/toast/toast";
import {
  userFormModeAtom,
  editingUserAtom,
  deletingUserAtom,
  passwordChangeUserAtom,
  openCreateUserFormAtom,
  openEditUserFormAtom,
  closeUserFormAtom,
  openDeleteUserDialogAtom,
  closeDeleteUserDialogAtom,
  openPasswordChangeDialogAtom,
  closePasswordChangeDialogAtom,
} from "@/infrastructure/state";
import { useUsers } from "./use-users";
import type { DashboardUser } from "@/lib/api";

function roleVariant(role: string): "success" | "warning" | "neutral" {
  switch (role) {
    case "admin":
      return "success";
    case "operator":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Page-level orchestration hook for the Users page.
 *
 * Uses Jotai atoms for cross-cutting UI state (form mode, editing user,
 * delete/password dialogs) so other components (dashboard, side panel)
 * can coordinate with user management.
 *
 * TanStack Query handles server state (user list, mutations).
 */
export function useUsersPage() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, deleteUser: deleteMutation, changePassword: passwordMutation } = useUsers();

  // ── Jotai atoms — cross-cutting UI state ──────────────────────────
  const formMode = useAtomValue(userFormModeAtom);
  const editingUser = useAtomValue(editingUserAtom);
  const deletingUser = useAtomValue(deletingUserAtom);
  const passwordUser = useAtomValue(passwordChangeUserAtom);

  const handleCreate = useSetAtom(openCreateUserFormAtom);
  const openEdit = useSetAtom(openEditUserFormAtom);
  const closeForm = useSetAtom(closeUserFormAtom);
  const openDeleteDialog = useSetAtom(openDeleteUserDialogAtom);
  const closeDeleteDialog = useSetAtom(closeDeleteUserDialogAtom);
  const openPasswordDialog = useSetAtom(openPasswordChangeDialogAtom);
  const closePasswordDialog = useSetAtom(closePasswordChangeDialogAtom);

  const handleEdit = useCallback((user: DashboardUser) => openEdit(user), [openEdit]);

  const handleCloseForm = useCallback(() => {
    closeForm();
    query.refetch();
  }, [closeForm, query]);

  const handleDelete = useCallback(async () => {
    if (!deletingUser) return;
    try {
      await deleteMutation.mutateAsync(deletingUser.id);
      toast.success(_(msg`User deleted.`));
      query.refetch();
    } catch {
      toast.error(_(msg`Failed to delete user.`));
    } finally {
      closeDeleteDialog();
    }
  }, [deletingUser, deleteMutation, query, toast, closeDeleteDialog, _]);

  const handlePasswordChange = useCallback(
    async (id: string, password: string) => {
      await passwordMutation.mutateAsync({ id, password });
    },
    [passwordMutation],
  );

  const columns: DataTableColumn<DashboardUser, string>[] = useMemo(
    () => [
      { id: "username", header: _(msg`Username`), accessor: (u) => u.username, sortable: true },
      {
        id: "display_name",
        header: _(msg`Display Name`),
        accessor: (u) => u.display_name || "—",
        sortable: true,
      },
      {
        id: "role",
        header: _(msg`Role`),
        accessor: (u) => u.role,
        cell: (u) => <Badge variant={roleVariant(u.role)}>{u.role}</Badge>,
      },
      {
        id: "active",
        header: _(msg`Status`),
        accessor: (u) => (u.active ? "active" : "inactive"),
        cell: (u) => (
          <Badge variant={u.active ? "success" : "neutral"}>
            {u.active ? _(msg`Active`) : _(msg`Inactive`)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: _(msg`Actions`),
        accessor: () => "",
        cell: (u) => (
          <ActionGroup>
            <IconButton size="sm" aria-label={_(msg`Edit`)} onClick={() => handleEdit(u)}>
              <IconPencil size={14} />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={_(msg`Change password`)}
              onClick={() => openPasswordDialog(u)}
            >
              <IconKey size={14} />
            </IconButton>
            <IconButton
              size="sm"
              accent="tertiary"
              aria-label={_(msg`Delete`)}
              onClick={() => openDeleteDialog(u)}
            >
              <IconTrash size={14} />
            </IconButton>
          </ActionGroup>
        ),
      },
    ],
    [_, handleEdit, openPasswordDialog, openDeleteDialog],
  );

  return {
    query,
    deleteMutation,
    passwordMutation,
    formMode,
    editingUser,
    deletingUser,
    passwordUser,
    closeDeleteDialog,
    closePasswordDialog,
    handleCreate,
    handleCloseForm,
    handleDelete,
    handlePasswordChange,
    columns,
    users: query.data ?? [],
  } as const;
}
