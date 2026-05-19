import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useZodForm } from "@/lib/form";
import { QueryKeys } from "@/lib/query-keys";
import type { Role } from "@shared/roles";
import {
  fetchUsers,
  createUser,
  updateUser,
  type DashboardUser,
  type CreateDashboardUserRequest,
  type UpdateDashboardUserRequest,
} from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";
import {
  createUserFormSchema,
  type UserFormValues,
} from "../schemas/user-form.schema";

/**
 * Hook for the user create/edit form.
 *
 * Manages react-hook-form with zod validation, fetches the user list,
 * and handles the create/update mutation with toast feedback.
 *
 * @param existingUser — Existing user to edit, or undefined for create.
 * @param onSuccess — Called after a successful create/update (e.g., close dialog + refetch).
 */
export function useUserForm(
  existingUser?: DashboardUser,
  onSuccess?: () => void,
) {
  const isEditing = !!existingUser;
  const toast = useToast();
  const { _ } = useLingui();

  // Fetch users list (for the parent page)
  const usersQuery = useQuery({
    queryKey: QueryKeys.users.list(),
    queryFn: fetchUsers,
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

  // Populate form when editing
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
      if (isEditing && existingUser) {
        const req: UpdateDashboardUserRequest = {
          display_name: data.display_name || null,
          role: data.role as Role,
          active: data.active,
        };
        return updateUser(existingUser.id, req);
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
        isEditing
          ? _(msg`User updated successfully.`)
          : _(msg`User created successfully.`),
      );
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
    isSaving: saveMutation.isPending,
    handleSubmit,
    usersQuery,
  } as const;
}
