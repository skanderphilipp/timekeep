/**
 * Query Params Infrastructure
 *
 * URL-synced filter, sort, and pagination hooks for list pages.
 * Every list page should use `useListState` to get automatic URL sync + queryKey.
 *
 * Import like: import { useListState, SortField, ... } from "@/infrastructure/query-params";
 */

export { useFilterUrl } from "./use-filter-url";
export { useSortUrl } from "./use-sort-url";
export { usePageUrl } from "./use-page-url";
export { useListState } from "./use-list-state";

export type {
  FilterValues,
  FilterUrlOptions,
  SortField,
  SortUrlOptions,
  PageUrlOptions,
  ListStateOptions,
} from "./types";
