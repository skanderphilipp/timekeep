/**
 * useSchemaColumns — schema-driven column generation
 *
 * Fetches the entity schema from the backend and maps it to data-renderer
 * ColumnDefinitions. Replaces hardcoded createXxxColumns() factories.
 *
 * Usage:
 *   const { columns, isLoading } = useSchemaColumns("punch");
 *   // columns: ColumnDefinition[] — ready to pass to DataTableContainer
 *
 * When other entities get schemas (device, audit, employee), this hook works
 * unchanged — just pass the entity name.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { QueryKeys } from "@/lib/query-keys";
import { fetchPunchSchema } from "@/lib/api";
import type { EntitySchema } from "@/types/metadata";
import {
	columnMetaToDefinition,
	getPresentationOverride,
} from "../schema-mapper";
import type { ColumnDefinition, FieldMetadata } from "../types";

// ── Entity → Schema Fetcher Registry ────────────────────────────────────

/**
 * Registry mapping entity names to their schema fetchers.
 *
 * When a new entity gets a schema endpoint, add it here.
 *
 * TODO(ENTERPRISE): Generalize when backend supports /api/{entity}/schema for all entities.
 *   Phase: Phase 2 (other entity schemas)
 *   Impact: Currently only "punch" has a schema. Other entities fall through to error.
 *   Fix: Add schema definitions in timekeep-core/src/query/schema.rs following PUNCH_SCHEMA pattern,
 *        then add fetchers here for each entity.
 */
const SCHEMA_FETCHERS: Record<string, () => Promise<EntitySchema>> = {
	punch: fetchPunchSchema,
};

function getSchemaFetcher(entity: string): (() => Promise<EntitySchema>) | undefined {
	return SCHEMA_FETCHERS[entity];
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useSchemaColumns(entity: string) {
	const fetcher = getSchemaFetcher(entity);

	const { data: schema, isLoading } = useQuery({
		queryKey: QueryKeys.punches.schema(), // TODO(ENTERPRISE): generalize per entity
		queryFn: fetcher ?? (() => Promise.reject(new Error(`No schema for entity: ${entity}`))),
		staleTime: Infinity, // schema is static per entity
		enabled: !!fetcher,
	});

	const columns: ColumnDefinition<FieldMetadata>[] = useMemo(() => {
		if (!schema) return [];

		return schema.columns
			.filter((col) => col.field !== schema.tiebreaker)
			.map((col) => {
				const overrides = getPresentationOverride(entity, col.field);
				return columnMetaToDefinition(col, overrides);
			});
	}, [schema, entity]);

	return { columns, schema, isLoading } as const;
}
