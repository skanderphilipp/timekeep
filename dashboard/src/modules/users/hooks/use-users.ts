import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  type CreateDashboardUserRequest,
  type UpdateDashboardUserRequest,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Dashboard user management hook.
 *
 * Provides query for listing users and mutations for CRUD operations.
 * After any mutation, invalidates the users list to refetch.
 */
export function useUsers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QueryKeys.users.list(),
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateDashboardUserRequest) => createUser(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.users.list() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...req }: { id: string } & UpdateDashboardUserRequest) =>
      updateUser(id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.users.list() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.users.list() });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      changePassword(id, password),
  });

  return {
    query,
    createUser: createMutation,
    updateUser: updateMutation,
    deleteUser: deleteMutation,
    changePassword: passwordMutation,
  } as const;
}
