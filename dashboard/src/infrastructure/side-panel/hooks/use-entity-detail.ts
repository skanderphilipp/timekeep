import { useQuery } from "@tanstack/react-query";
import type { EntityType } from "@/types/entities";
import { QueryKeys } from "@/lib/query-keys";
import { PUNCHES_STALE_TIME_MS } from "@/lib/constants";

/**
 * Hook to fetch a single entity's detail for the side panel.
 *
 * Routes to the correct API endpoint based on entity type.
 *
 * TODO(ENTERPRISE): Implement real API calls for each entity type.
 * Phase: Side panel live data
 * Impact: Detail views show static placeholder data instead of live entity info.
 * Fix: Implement per-type fetchers in @/lib/api.
 */
export function useEntityDetail(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: QueryKeys.entityDetail.detail(entityType, entityId),
    queryFn: async () => {
      /**
       * TODO(ENTERPRISE): Route to real API calls per entity type.
       * Phase: Side panel live data
       * Impact: Returns null / empty data; side panel shows "no data" state.
       * Fix: Implement per-type fetchers in @/lib/api.
       */
      switch (entityType) {
        case "device":
        case "punch":
        case "user":
        case "api_key":
        case "audit":
          return null;
        default:
          return null;
      }
    },
    enabled: entityId.length > 0,
    staleTime: PUNCHES_STALE_TIME_MS,
  });
}
