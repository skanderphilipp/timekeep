import { useEffect } from "react";
import { useStore } from "jotai";
import {
  fetchPunchSchema,
  fetchDeviceSchema,
  fetchEmployeeSchema,
  fetchAuditSchema,
  fetchDepartmentSchema,
  fetchWorkPolicyTemplateSchema,
} from "@/lib/api";
import { entitySchemaFamilyState } from "../states/entity-schema-family-state";
import { metadataStatusFamilyState } from "../states/metadata-status-family-state";
import type { EntitySchema } from "@/types/metadata";

/**
 * Registry: entity name → schema fetcher.
 */
const SCHEMA_FETCHERS: Record<string, () => Promise<EntitySchema>> = {
  punch: fetchPunchSchema,
  device: fetchDeviceSchema,
  employee: fetchEmployeeSchema,
  audit: fetchAuditSchema,
  department: fetchDepartmentSchema,
  work_policy: fetchWorkPolicyTemplateSchema,
};

/**
 * Pre-fetches all known entity schemas on app initialization.
 *
 * Place `<MetadataHydrator />` inside your app root (e.g., in AppShell).
 * It fires all schema requests in parallel and populates the Jotai metadata store.
 * Subsequent calls to `useEntitySchema(entity)` will read from the store
 * instead of re-fetching.
 *
 * Each entity is only fetched once — the status atom prevents duplicate requests.
 *
 * @example
 * ```tsx
 * function AppShell() {
 *   return (
 *     <>
 *       <MetadataHydrator />
 *       <Routes />
 *     </>
 *   );
 * }
 * ```
 */
export function useHydrateMetadata() {
  const store = useStore();

  useEffect(() => {
    const entities = Object.keys(SCHEMA_FETCHERS);

    for (const entity of entities) {
      const status = store.get(metadataStatusFamilyState(entity));
      if (status !== "empty") continue;

      const fetcher = SCHEMA_FETCHERS[entity];
      if (!fetcher) continue;

      store.set(metadataStatusFamilyState(entity), "loading");

      fetcher()
        .then((schema) => {
          store.set(entitySchemaFamilyState(entity), schema);
          store.set(metadataStatusFamilyState(entity), "ready");
        })
        .catch(() => {
          store.set(metadataStatusFamilyState(entity), "error");
        });
    }
  }, [store]);
}
