import { atom } from "jotai";

/**
 * Dynamic label for the last breadcrumb segment.
 *
 * Set by {@link PageShell} when a detail page provides a `pageLabel` prop
 * (e.g. an employee name instead of a UUID). Read by {@link AppTopBar} to
 * pass to `useBreadcrumbs`.
 */
export const pageBreadcrumbLabelAtom = atom<string | undefined>(undefined);
