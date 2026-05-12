import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEndpoints, createEndpoint, updateEndpoint, deleteEndpoint, type CreateEndpointRequest, type UpdateEndpointRequest } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

export function useEndpoints() {
  const qc = useQueryClient();

  const query = useQuery({ queryKey: QueryKeys.endpoints.list(), queryFn: fetchEndpoints });

  const create = useMutation({
    mutationFn: (r: CreateEndpointRequest) => createEndpoint(r),
    onSuccess: () => qc.invalidateQueries({ queryKey: QueryKeys.endpoints.list() }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...r }: { id: string } & UpdateEndpointRequest) => updateEndpoint(id, r),
    onSuccess: () => qc.invalidateQueries({ queryKey: QueryKeys.endpoints.list() }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QueryKeys.endpoints.list() }),
  });

  return { query, create, update, remove } as const;
}
