import { useQuery } from "@tanstack/react-query";
import type { EntityType } from "@/types/entities";
import { QueryKeys } from "@/lib/query-keys";
import { ENTITY_DEFINITIONS } from "../entity-definitions";

/**
 * Unified data fetching hook for any entity detail view.
 *
 * Uses {@link ENTITY_DEFINITIONS} as the single source of truth —
 * adding a new entity only requires adding an entry to the registry,
 * not modifying this file or importing per-entity API functions.
 *
 * @example
 * const { data: employee } = useRecordDetail("employee", "abc-123");
 * const { data: department } = useRecordDetail("department", "xyz-456");
 */
export function useRecordDetail(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: QueryKeys.entityDetail.detail(entityType, entityId),
    queryFn: async () => {
      const def = ENTITY_DEFINITIONS[entityType];
      if (!def?.fetchById) return null;
      return def.fetchById(entityId);
    },
    enabled: entityId.length > 0,
  });
}
