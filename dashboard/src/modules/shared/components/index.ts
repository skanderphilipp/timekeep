/**
 * Cross-cutting composite components — used by multiple modules.
 *
 * These sit between the pure UI primitives (components/ui/) and
 * domain-specific module components (modules/{domain}/components/).
 *
 * They may have opinionated defaults or light domain awareness
 * (event types, view types, status colors) but no hard domain imports.
 */

// ── State orchestration ──────────────────────────────────────────────────
export { PageError } from "./page-error";
export { ListError } from "./list-error";
export { DataBoundary } from "./data-boundary";

// ── Data visualization ──────────────────────────────────────────────────
export { StorageGauge } from "./storage-gauge";

// ── Attendance / time ────────────────────────────────────────────────────
export { CalendarMonth, generateDays, isoDate, isWeekend, sameDay, formatHours } from "./calendar-month";
export type { CalendarMonthProps, CalendarDayData, CalendarDayStatus } from "./calendar-month";
export { Timeline } from "./timeline";
export type { TimelineBlockData, TimelineRowData } from "./timeline";

// ── List views ───────────────────────────────────────────────────────────
export { ViewBar } from "./view-bar";
export type { ViewBarProps, ViewType, ViewBarFilterChip, SortChip } from "./view-bar";

// ── Activity / events ────────────────────────────────────────────────────
export { ActivityFeed } from "./activity-feed";

// ── Access control ───────────────────────────────────────────────────────
export { PermissionMultiSelect } from "./permission-multiselect";
