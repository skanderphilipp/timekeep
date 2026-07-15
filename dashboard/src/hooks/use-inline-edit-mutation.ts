import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Configuration for {@link useInlineEditMutation}.
 */
export type UseInlineEditMutationConfig<
  TRecord extends Record<string, unknown>,
> = {
  /**
   * The TanStack Query key for the list that should be optimistically updated.
   *
   * @example `QueryKeys.employees.list()`
   */
  queryKey: QueryKey;
  /**
   * Extracts the row identifier from a record.
   * Must match the `getRowKey` used by the parent DataTable.
   *
   * @example `(row) => row.id as string`
   */
  getRowKey: (record: TRecord) => string;
  /**
   * The actual API mutation. Receives the decomposed cell update.
   *
   * @example
   * ```ts
   * mutationFn: ({ rowId, field, value }) =>
   *   apiPut(`/api/employees/${rowId}`, { [field]: value }).json()
   * ```
   */
  mutationFn: (params: {
    rowId: string;
    field: string;
    value: unknown;
  }) => Promise<TRecord>;
};

/**
 * Cell update payload — what `onPersist` passes to the mutation.
 */
export type CellUpdate = {
  rowId: string;
  field: string;
  value: unknown;
};

/**
 * Optimistic inline-edit mutation hook.
 *
 * Updates the cache immediately when a cell is edited (optimistic update),
 * rolls back on failure, and invalidates the query on settle to ensure
 * server-side consistency.
 *
 * Pattern: ported from Twenty's `useUpdateOneRecord` with simplified
 * cache manipulation (no record store, just direct query cache access).
 *
 * @example
 * ```ts
 * const editEmployee = useInlineEditMutation({
 *   queryKey: QueryKeys.employees.list(),
 *   getRowKey: (e) => e.id,
 *   mutationFn: ({ rowId, field, value }) =>
 *     apiPut(`/api/employees/${rowId}`, { [field]: value }).json(),
 * });
 *
 * // In EditableCell:
 * <EditableCell
 *   onPersist={(rowId, colId, val) =>
 *     editEmployee.mutate({ rowId, field: colId, value: val })
 *   }
 * />
 * ```
 */
export function useInlineEditMutation<
  TRecord extends Record<string, unknown>,
>({
  queryKey,
  getRowKey,
  mutationFn,
}: UseInlineEditMutationConfig<TRecord>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rowId, field, value }: CellUpdate) =>
      mutationFn({ rowId, field, value }),

    onMutate: async ({ rowId, field, value }: CellUpdate) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous state for rollback
      const previous = queryClient.getQueryData<TRecord[]>(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData<TRecord[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((row) =>
          getRowKey(row) === rowId
            ? { ...row, [field]: value }
            : row,
        );
      });

      // Return the snapshot for the error handler
      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Rollback to the previous state on failure
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      // Refetch to ensure server-side consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
