import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  type UpdateSystemSettingsRequest,
  type CreateEndpointRequest,
  type UpdateEndpointRequest,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { SETTINGS_STALE_TIME_MS } from "@/lib/constants";

/**
 * System settings hook — React Query wrapper replacing raw useEffect.
 *
 * Provides query for reading settings and mutation for updating.
 * Invalidates the settings cache on successful update.
 */
export function useSystemSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QueryKeys.settings.system(),
    queryFn: fetchSystemSettings,
    staleTime: SETTINGS_STALE_TIME_MS,
  });

  const mutation = useMutation({
    mutationFn: (settings: UpdateSystemSettingsRequest) =>
      updateSystemSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.settings.system() });
    },
  });

  return {
    query,
    updateSettings: mutation,
  } as const;
}

/**
 * Integration endpoints hook — full CRUD via React Query.
 */
export function useEndpoints() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QueryKeys.endpoints.settings(),
    queryFn: fetchEndpoints,
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateEndpointRequest) => createEndpoint(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.endpoints.settings() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...req }: { id: string } & UpdateEndpointRequest) =>
      updateEndpoint(id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.endpoints.settings() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEndpoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.endpoints.settings() });
    },
  });

  return {
    query,
    createEndpoint: createMutation,
    updateEndpoint: updateMutation,
    deleteEndpoint: deleteMutation,
  } as const;
}
