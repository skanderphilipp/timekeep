import { createFamilyState } from "@/infrastructure/state/jotai";
import type { EntitySchema } from "@/types/metadata";
import type { EntityType } from "@/types/entities";

/**
 * Atom family storing entity schemas, keyed by entity name.
 *
 * Each entity (punch, device, employee, audit) has its own atom
 * in this family. Schemas are fetched once at app init via
 * {@link MetadataHydrator} and shared across all components.
 *
 * Transient — re-fetched on every app mount (but only once per session).
 * Future: consider IndexedDB persistence for offline/instant display.
 */
export const entitySchemaFamilyState = createFamilyState<
  EntitySchema | null,
  string
>({
  key: "entitySchema",
  defaultValue: null,
});

/**
 * Supported entity types for metadata hydration.
 * Mirrors the backend entities that expose `/api/{entity}/schema`.
 */
export const SCHEMA_ENTITIES = [
  "punch",
  "device",
  "employee",
  "audit",
] as const satisfies readonly EntityType[];

export type SchemaEntity = (typeof SCHEMA_ENTITIES)[number];
