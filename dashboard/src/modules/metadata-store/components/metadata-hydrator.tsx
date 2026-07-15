import { useHydrateMetadata } from "../hooks/use-hydrate-metadata";

/**
 * Hydrates the Jotai metadata store on app mount.
 *
 * Fires all entity schema fetches in parallel. Place once in your app root
 * (AppShell or equivalent). Renders nothing — purely a side effect.
 *
 * @example
 * ```tsx
 * <MetadataHydrator />
 * ```
 */
export function MetadataHydrator() {
  useHydrateMetadata();
  return null;
}
