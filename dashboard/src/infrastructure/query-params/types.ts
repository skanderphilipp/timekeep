/**
 * Shared types for the query-params infrastructure.
 *
 * All URL-synced state hooks use these types so pages can compose
 * filter + sort + pagination without re-declaring the same shapes.
 */

/** Sort column + direction, synced to URL as `{ns}_sort` + `{ns}_order`. */
export type SortField = {
  column: string;
  direction: "asc" | "desc";
};

/** Flat string-keyed filter object. Every value is `string | undefined`. */
export type FilterValues = Record<string, string | undefined>;

/** Options for `useFilterUrl`. */
export type FilterUrlOptions<T extends FilterValues> = {
  /** Default values used when URL params are absent. */
  defaults: T;
  /** Namespace scopes URL params to a specific page (e.g. "punches", "devices"). */
  namespace: string;
};

/** Options for `useSortUrl`. */
export type SortUrlOptions = {
  namespace: string;
  /** Default sort state. `null` = no sort applied. */
  defaultSort?: SortField | null;
};

/** Options for `usePageUrl`. */
export type PageUrlOptions = {
  namespace: string;
  /** Starting page number (default: 1). */
  defaultPage?: number;
};

/** Options for the composite `useListState` hook. */
export type ListStateOptions<T extends FilterValues> = {
  namespace: string;
  filterDefaults: T;
  sortDefaults?: SortField | null;
  defaultPage?: number;
};

/** Options for `useViewUrl` — syncs a view ID to URL search params. */
export type ViewUrlOptions = {
  /** Namespace scopes the URL param to a specific page (e.g. "punches", "devices"). */
  namespace: string;
};
