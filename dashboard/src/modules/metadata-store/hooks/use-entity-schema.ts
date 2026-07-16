import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
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
 * Reads an entity schema from the Jotai metadata store.
 *
 * If the schema hasn't been fetched yet (status === 'empty'), it triggers
 * a fetch. Once loaded, the schema is shared across all components via Jotai.
 *
 * No React Query dependency — the schema lives in Jotai state.
 *
 * @param entity - Entity name (e.g., "punch", "device")
 * @returns The entity schema, or `null` if still loading / not available.
 *
 * @example
 * ```ts
 * const schema = useEntitySchema("punch");
 * if (!schema) return <Loading />;
 * ```
 */
export function useEntitySchema(entity: string): EntitySchema | null {
  const schema = useAtomValue(entitySchemaFamilyState(entity));
  const status = useAtomValue(metadataStatusFamilyState(entity));
  const setSchema = useSetAtom(entitySchemaFamilyState(entity));
  const setStatus = useSetAtom(metadataStatusFamilyState(entity));

  useEffect(() => {
    if (status !== "empty") return;

    const fetcher = SCHEMA_FETCHERS[entity];
    if (!fetcher) return;

    setStatus("loading");

    fetcher()
      .then((result) => {
        setSchema(result);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error"); // prevent infinite retry loop
      });
  }, [entity, status, setSchema, setStatus]);

  return schema;
}

/**
 * Returns whether the schema for the given entity is currently loading.
 */
export function useEntitySchemaLoading(entity: string): boolean {
  const status = useAtomValue(metadataStatusFamilyState(entity));
  return status === "loading";
}
