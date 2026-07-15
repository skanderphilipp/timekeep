import { createFamilyState } from "@/infrastructure/state/jotai";

/**
 * Loading status per metadata entity.
 *
 * - `'empty'` — schema has never been fetched
 * - `'loading'` — currently fetching from API
 * - `'ready'` — schema is available in the family state
 */
export type MetadataStatus = "empty" | "loading" | "ready";

/**
 * Atom family tracking the hydration status of each entity schema.
 * Keyed by entity name (e.g., "punch", "device").
 */
export const metadataStatusFamilyState = createFamilyState<
  MetadataStatus,
  string
>({
  key: "metadataStatus",
  defaultValue: "empty",
});
