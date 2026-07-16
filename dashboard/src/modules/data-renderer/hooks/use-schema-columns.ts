/**
 * useSchemaColumns — schema-driven column generation
 *
 * Reads entity schemas from the Jotai metadata store (fast, shared, persisted).
 * Falls back to fetching from API if the schema hasn't been hydrated yet.
 *
 * Usage:
 *   const { columns, isLoading } = useSchemaColumns("punch");
 *   // columns: ColumnDefinition[] — ready to pass to DataTableContainer
 */

import { useMemo } from "react";

import { useEntitySchema, useEntitySchemaLoading } from "@/modules/metadata-store/hooks/use-entity-schema";
import {
  columnMetaToDefinition,
  getPresentationOverride,
} from "../schema-mapper";
import type { ColumnDefinition, FieldMetadata } from "../types";

/**
 * Schema-driven column hook.
 *
 * Reads from the Jotai metadata store. If the schema hasn't been hydrated
 * (e.g., before <MetadataHydrator /> runs), `useEntitySchema` triggers a fetch.
 *
 * Schemas are shared across all components — no duplicate fetches,
 * no React Query dependency.
 */
export function useSchemaColumns(entity: string) {
  const schema = useEntitySchema(entity);
  const isLoading = useEntitySchemaLoading(entity);

  const columns: ColumnDefinition<FieldMetadata>[] = useMemo(() => {
    if (!schema) return [];

    return schema.columns
      .filter((col) => col.field !== schema.tiebreaker)
      .map((col) => {
        const overrides = getPresentationOverride(entity, col.field);
        return columnMetaToDefinition(col, entity, overrides);
      });
  }, [schema, entity]);

  return { columns, schema, isLoading } as const;
}
