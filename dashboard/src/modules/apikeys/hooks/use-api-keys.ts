import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApiKeys, createApiKey, revokeApiKey, type CreateApiKeyRequest } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * API key management hook.
 *
 * Provides query for listing keys and mutations for creation/revocation.
 * After any mutation, invalidates the api-keys list to refetch.
 */
export function useApiKeys() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QueryKeys.apiKeys.list(),
    queryFn: fetchApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateApiKeyRequest) => createApiKey(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.apiKeys.list() });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.apiKeys.list() });
    },
  });

  return {
    query,
    createKey: createMutation,
    revokeKey: revokeMutation,
  } as const;
}
