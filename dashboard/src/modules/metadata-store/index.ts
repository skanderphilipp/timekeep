/**
 * Metadata Store — centralized Jotai-backed entity schema management.
 *
 * Replaces per-component React Query schema fetching with a shared,
 * persisted Jotai atom family. Schemas are fetched once on app init
 * and shared across all components via Jotai.
 *
 * ## Quick Start
 *
 * ```tsx
 * // 1. Add hydration to your app root
 * import { MetadataHydrator } from "@/modules/metadata-store";
 *
 * function AppShell() {
 *   return (
 *     <>
 *       <MetadataHydrator />
 *       <Routes />
 *     </>
 *   );
 * }
 *
 * // 2. Read schemas from any component
 * import { useEntitySchema } from "@/modules/metadata-store";
 *
 * function MyComponent() {
 *   const schema = useEntitySchema("punch");
 *   if (!schema) return <Loading />;
 * }
 * ```
 */

// ── States ────────────────────────────────────────────────────────────

export {
  entitySchemaFamilyState,
  SCHEMA_ENTITIES,
  type SchemaEntity,
} from "./states/entity-schema-family-state";

export {
  metadataStatusFamilyState,
  type MetadataStatus,
} from "./states/metadata-status-family-state";

// ── Hooks ─────────────────────────────────────────────────────────────

export {
  useEntitySchema,
  useEntitySchemaLoading,
} from "./hooks/use-entity-schema";

export { useHydrateMetadata } from "./hooks/use-hydrate-metadata";

// ── Components ────────────────────────────────────────────────────────

export { MetadataHydrator } from "./components/metadata-hydrator";
