/**
 * Application shell layout components.
 *
 * Import like: import { PageShell, PageBar } from "@/components/layout";
 *
 * PageLayout and PageBody are internal to PageShell — do NOT import directly.
 *
 * Breadcrumb-related types are re-exported from the navigation infrastructure.
 */

export { PageShell } from "./page-shell";
export { PageBar } from "./page-bar";
export type { BreadcrumbSegment } from "@/infrastructure/navigation";
export { PageHeader } from "./page-header";
