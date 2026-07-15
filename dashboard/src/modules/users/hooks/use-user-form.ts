import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useZodForm } from "@/lib/form";
import { QueryKeys } from "@/lib/query-keys";
import type { Role } from "@shared/roles";
import {
  fetchUsers,
  fetchUser,
  createUser,
  updateUser,
  type CreateDashboardUserRequest,
  type UpdateDashboardUserRequest,
} from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";
import { createUserFormSchema, type UserFormValues } from "../schemas/user-form.schema";

/**
 * Hook for the user create/edit form.
 *
 * Manages react-hook-form with zod validation, fetches the user list,
 * and handles the create/update mutation with toast feedback.
 *
 * When editing, fetches the existing user by ID to populate the form.
 * When creating (no ID), uses default empty values.
 *
 * @param existingId — Existing user ID to edit, or undefined for create.
 * @param onSuccess — Called after a successful create/update (e.g., close dialog + refetch).
 */
export function useUserForm(existingId?: string, onSuccess?: () => void) {
  const isEditing = !!existingId;
  const toast = useToast();
  const queryClient = useQueryClient();
  const { _ } = useLingui();

  // Fetch users list (for the parent page)
  const usersQuery = useQuery({
    queryKey: QueryKeys.users.list(),
    queryFn: fetchUsers,
  });

  // Fetch existing user when editing
  const { data: existingUser, isLoading: isLoadingUser } = useQuery({
    queryKey: QueryKeys.users.detail(existingId!),
    queryFn: () => fetchUser(existingId!),
    enabled: isEditing,
  });

  // React Hook Form with zod validation
  const form = useZodForm(createUserFormSchema(_), {
    defaultValues: {
      username: "",
      password: "",
      display_name: "",
      role: "viewer" as const,
      active: true,
    },
  });

  // Populate form when editing and user data arrives
  useEffect(() => {
    if (existingUser && isEditing) {
      form.reset({
        username: existingUser.username,
        password: "",
        display_name: existingUser.display_name ?? "",
        role: existingUser.role as "admin" | "operator" | "viewer",
        active: existingUser.active,
      });
    }
  }, [existingUser, isEditing, form]);

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: (data: UserFormValues) => {
      if (isEditing && existingId) {
        const req: UpdateDashboardUserRequest = {
          display_name: data.display_name || null,
          role: data.role as Role,
          active: data.active,
        };
        return updateUser(existingId, req);
      }
      const req: CreateDashboardUserRequest = {
        username: data.username,
        password: data.password!,
        display_name: data.display_name || null,
        role: data.role as Role,
      };
      return createUser(req);
    },
    onSuccess: () => {
      toast.success(
        isEditing ? _(msg`User updated successfully.`) : _(msg`User created successfully.`),
      );
      queryClient.invalidateQueries({ queryKey: QueryKeys.users.list() });
      form.reset();
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = form.handleSubmit((data) => {
    saveMutation.mutate(data);
  });

  return {
    form,
    isEditing,
    isLoadingUser,
    isSaving: saveMutation.isPending,
    handleSubmit,
    usersQuery,
  } as const;
}
