import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EntityType } from "@/types/entities";
import { QueryKeys } from "@/lib/query-keys";
import { updateEmployee } from "@/lib/api/employees";
import { updateDepartment } from "@/lib/api/departments";
import { updateDevice } from "@/lib/api/devices";
import { updateUser } from "@/lib/api/users";
import { updateEndpoint } from "@/lib/api/integrations";
import { updateDeviceGroup } from "@/lib/api/device-groups";
import { updateWorkPolicyTemplate } from "@/lib/api/work-policies";

/**
 * Cell update payload — what inline field editing passes to the mutation.
 */
export type CellUpdate = {
  rowId: string;
  field: string;
  value: unknown;
};

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Per-entity configuration for inline editing.
 *
 * Adding a new entity is a one-line entry: import the update function,
 * define its query key, and wrap the API call. No switch statements,
 * no per-entity branch in the mutation logic.
 *
 * Entities NOT in this registry (punch, audit, api_key) are read‑only
 * in detail views — clicking their editable fields is a no-op.
 */
type InlineEditUpdater = (
  id: string,
  field: string,
  value: unknown,
) => Promise<Record<string, unknown>>;

type InlineEditEntityConfig = {
  /** Wraps the API update function with field‑to‑object conversion. */
  updateFn: InlineEditUpdater;
  /** Query key for the list — used for optimistic cache updates and invalidation. */
  listQueryKey: () => readonly unknown[];
  /**
   * Primary key field on row objects for optimistic cache matching.
   * Most entities use `"id"`; devices use `"serial_number"`.
   */
  idField?: string;
};

const INLINE_EDIT_REGISTRY: Partial<Record<EntityType, InlineEditEntityConfig>> = {
  employee: {
    updateFn: (id, field, value) =>
      updateEmployee(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.employees.list(),
  },
  department: {
    updateFn: (id, field, value) =>
      updateDepartment(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.departments.list(),
  },
  device: {
    updateFn: (id, field, value) =>
      updateDevice(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.devices.list(),
    idField: "serial_number",
  },
  user: {
    updateFn: (id, field, value) =>
      updateUser(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.users.list(),
  },
  endpoint: {
    updateFn: (id, field, value) =>
      updateEndpoint(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.endpoints.list(),
  },
  device_group: {
    updateFn: (id, field, value) =>
      updateDeviceGroup(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.deviceGroups.list(),
  },
  work_policy: {
    updateFn: (id, field, value) =>
      updateWorkPolicyTemplate(id, { [field]: value }) as Promise<Record<string, unknown>>,
    listQueryKey: () => QueryKeys.workPolicies.list(),
  },
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Shared inline edit mutation for detail views.
 *
 * Lookups the entity type in {@link INLINE_EDIT_REGISTRY} to find the
 * correct API update function, query keys, and primary key field.
 * Performs optimistic cache updates for the list query, rolls back on
 * failure, and invalidates the list on settle.
 *
 * Pattern: ported from Twenty's `useUpdateOneRecord` with simplified
 * cache manipulation (direct query cache access instead of record store).
 */
export function useRecordInlineEdit(entityType: EntityType) {
  const queryClient = useQueryClient();
  const config = INLINE_EDIT_REGISTRY[entityType];

  return useMutation({
    mutationFn: async ({ rowId, field, value }: CellUpdate) => {
      if (!config) {
        throw new Error(`Inline edit not supported for entity type: ${entityType}`);
      }
      return config.updateFn(rowId, field, value);
    },

    onMutate: async ({ rowId, field, value }: CellUpdate) => {
      if (!config) return;

      const queryKey = config.listQueryKey();
      const idField = config.idField ?? "id";

      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous state for rollback
      const previous = queryClient.getQueryData<Record<string, unknown>[]>(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData<Record<string, unknown>[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((row) =>
          (row as Record<string, unknown>)[idField] === rowId
            ? { ...row, [field]: value }
            : row,
        );
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Rollback to the previous state on failure
      if (context?.previous && config) {
        queryClient.setQueryData(config.listQueryKey(), context.previous);
      }
    },

    onSettled: () => {
      // Refetch to ensure server-side consistency
      if (config) {
        queryClient.invalidateQueries({ queryKey: config.listQueryKey() });
      }
    },
  });
}
