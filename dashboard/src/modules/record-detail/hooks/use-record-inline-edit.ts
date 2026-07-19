import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EntityType } from "@/types/entities";
import { QueryKeys } from "@/lib/query-keys";
import { ENTITY_DEFINITIONS } from "../entity-definitions";

/**
 * Cell update payload — what inline field editing passes to the mutation.
 */
export type CellUpdate = {
  rowId: string;
  field: string;
  value: unknown;
};

/**
 * Shared inline edit mutation for detail views.
 *
 * Uses {@link ENTITY_DEFINITIONS} as the single source of truth —
 * adding a new entity only requires adding an entry to the registry,
 * not modifying this file or importing per-entity API functions.
 *
 * Performs optimistic cache updates for the list query, rolls back on
 * failure, and invalidates the list on settle.
 */
export function useRecordInlineEdit(entityType: EntityType) {
  const queryClient = useQueryClient();
  const def = ENTITY_DEFINITIONS[entityType];

  return useMutation<Record<string, unknown>, Error, CellUpdate, { previousList: unknown; previousDetail: unknown } | undefined>({
    mutationFn: async ({ rowId, field, value }: CellUpdate) => {
      if (!def?.updateById) {
        throw new Error(`Inline edit not supported for entity type: ${entityType}`);
      }
      return def.updateById(rowId, field, value);
    },

    onMutate: async ({ rowId, field, value }: CellUpdate) => {
      if (!def) return;

      const listKey = def.listQueryKey();
      const detailKey = QueryKeys.entityDetail.detail(entityType, rowId);
      const idField = def.idField;

      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: detailKey });

      // Snapshot the previous state for rollback
      const previousList = queryClient.getQueryData<Record<string, unknown>[]>(listKey);
      const previousDetail = queryClient.getQueryData<Record<string, unknown>>(detailKey);

      // Optimistically update the LIST cache
      queryClient.setQueryData<Record<string, unknown>[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((row) =>
          (row as Record<string, unknown>)[idField] === rowId
            ? { ...row, [field]: value }
            : row,
        );
      });

      // Optimistically update the DETAIL cache (keeps side panel in sync)
      queryClient.setQueryData<Record<string, unknown>>(detailKey, (old) => {
        if (!old) return old;
        return { ...old, [field]: value };
      });

      return { previousList, previousDetail };
    },

    onError: (_err, _vars, context) => {
      // Rollback to the previous state on failure
      if (context && def) {
        if (context.previousList) {
          queryClient.setQueryData(def.listQueryKey(), context.previousList);
        }
        if (context.previousDetail) {
          queryClient.setQueryData(
            QueryKeys.entityDetail.detail(entityType, _vars.rowId),
            context.previousDetail,
          );
        }
      }
    },

    onSettled: (_data, _error, variables) => {
      if (def) {
        queryClient.invalidateQueries({ queryKey: def.listQueryKey() });
        queryClient.invalidateQueries({
          queryKey: QueryKeys.entityDetail.detail(entityType, variables.rowId),
        });
      }
    },
  });
}
