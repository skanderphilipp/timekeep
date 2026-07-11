import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPencil, IconKey, IconTrash } from "@tabler/icons-react";

import { Badge, IconButton, ActionGroup, type DataTableColumn } from "@/components/ui";
import { useToast } from "@/infrastructure/toast/toast";
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
 * All modal state, mutation handlers, column definitions, and CRUD logic
 * live here. The page is pure composition.
 */
export function useUsersPage() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, deleteUser: deleteMutation, changePassword: passwordMutation } = useUsers();

  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingUser, setEditingUser] = useState<DashboardUser | undefined>();
  const [deletingUser, setDeletingUser] = useState<DashboardUser | undefined>();
  const [passwordUser, setPasswordUser] = useState<DashboardUser | undefined>();

  const handleCreate = useCallback(() => {
    setEditingUser(undefined);
    setFormMode("create");
  }, []);

  const handleEdit = useCallback((user: DashboardUser) => {
    setEditingUser(user);
    setFormMode("edit");
  }, []);

  const handleCloseForm = useCallback(() => {
    setFormMode("closed");
    setEditingUser(undefined);
    query.refetch();
  }, [query]);

  const handleDelete = useCallback(async () => {
    if (!deletingUser) return;
    try {
      await deleteMutation.mutateAsync(deletingUser.id);
      toast.success(_(msg`User deleted.`));
      query.refetch();
    } catch {
      toast.error(_(msg`Failed to delete user.`));
    } finally {
      setDeletingUser(undefined);
    }
  }, [deletingUser, deleteMutation, query, toast, _]);

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
              onClick={() => setPasswordUser(u)}
            >
              <IconKey size={14} />
            </IconButton>
            <IconButton
              size="sm"
              accent="tertiary"
              aria-label={_(msg`Delete`)}
              onClick={() => setDeletingUser(u)}
            >
              <IconTrash size={14} />
            </IconButton>
          </ActionGroup>
        ),
      },
    ],
    [_, handleEdit],
  );

  return {
    query,
    deleteMutation,
    passwordMutation,
    formMode,
    editingUser,
    deletingUser,
    passwordUser,
    setDeletingUser,
    setPasswordUser,
    handleCreate,
    handleCloseForm,
    handleDelete,
    handlePasswordChange,
    columns,
    users: query.data ?? [],
  };
}
