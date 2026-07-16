import { useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPencil, IconKey, IconTrash } from "@tabler/icons-react";
import { useSetAtom } from "jotai";

import { useStateValue } from "@/infrastructure/state/jotai";

import { Badge, IconButton, ActionGroup } from "@/components/ui";
import { useToast } from "@/infrastructure/toast/toast";
import {
  userFormModeState,
  editingUserState,
  deletingUserState,
  passwordChangeUserState,
  openCreateUserFormAtom,
  openEditUserFormAtom,
  closeUserFormAtom,
  openDeleteUserDialogAtom,
  closeDeleteUserDialogAtom,
  openPasswordChangeDialogAtom,
  closePasswordChangeDialogAtom,
} from "@/modules/users/states/user-form-atoms";
import { useUsers } from "./use-users";
import type { DashboardUser } from "@/lib/api";
import type { ColumnDefinition, TextFieldMetadata, CellEditingConfig } from "@/modules/data-renderer";
import { useRecordInlineEdit } from "@/modules/record-detail";

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

  // ── Inline editing mutation ────────────────────────────────────────

  const editUser = useRecordInlineEdit("user");

  // ── Jotai atoms — cross-cutting UI state ──────────────────────────
  const formMode = useStateValue(userFormModeState);
  const editingUser = useStateValue(editingUserState);
  const deletingUser = useStateValue(deletingUserState);
  const passwordUser = useStateValue(passwordChangeUserState);

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

  /**
   * TODO(ENTERPRISE): Migrate to useSchemaColumns("user") when GET /api/users/schema is available.
   *
   * Phase: Backend API completion
   * Impact: Column definitions are hardcoded — schema-driven columns would provide
   *         sortability, filterability, and column visibility from the backend.
   * Fix: Add schema endpoint to backend, then replace this useMemo with useSchemaColumns("user").
   */
  const columns: ColumnDefinition[] = useMemo(
    () => [
      {
        id: "username",
        header: _(msg`Username`),
        fieldId: "username",
        label: _(msg`Username`),
        type: "text",
        metadata: { fieldName: "username", isSortable: true } as TextFieldMetadata,
        isVisible: true,
        width: "160px",
        isLabelIdentifier: true,
      },
      {
        id: "display_name",
        header: _(msg`Display Name`),
        fieldId: "display_name",
        label: _(msg`Display Name`),
        type: "text",
        metadata: { fieldName: "display_name", isSortable: true } as TextFieldMetadata,
        isVisible: true,
        width: "180px",
        editable: true,
      },
      {
        id: "role",
        header: _(msg`Role`),
        fieldId: "role",
        label: _(msg`Role`),
        type: "text",
        metadata: { fieldName: "role", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "120px",
        render: (row: unknown) => {
          const r = row as DashboardUser;
          return <Badge variant={roleVariant(r.role)}>{r.role}</Badge>;
        },
      },
      {
        id: "active",
        header: _(msg`Status`),
        fieldId: "active",
        label: _(msg`Status`),
        type: "text",
        metadata: { fieldName: "active", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "100px",
        render: (row: unknown) => {
          const r = row as DashboardUser;
          return (
            <Badge variant={r.active ? "success" : "neutral"}>
              {r.active ? _(msg`Active`) : _(msg`Inactive`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: _(msg`Actions`),
        fieldId: "actions",
        label: _(msg`Actions`),
        type: "text",
        metadata: { fieldName: "actions", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "120px",
        render: (row: unknown) => {
          const u = row as DashboardUser;
          return (
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
          );
        },
      },
    ],
    [_, handleEdit, openPasswordDialog, openDeleteDialog],
  );

  // ── Editing config passed to DataListView ──────────────────────────

  const editingConfig = useMemo<CellEditingConfig>(
    () => ({
      onPersist: (rowId: string, field: string, value: unknown) => {
        editUser.mutate({ rowId, field, value });
      },
      editableColumns: ["display_name"],
    }),
    [editUser.mutate],
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
    editingConfig,
    users: query.data ?? [],
  } as const;
}
