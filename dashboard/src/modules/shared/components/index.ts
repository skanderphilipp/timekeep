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
export { PageError } from "@/components/ui/page-error";
export { ListError } from "./list-error";
export { DataBoundary } from "./data-boundary";

// ── Data visualization ──────────────────────────────────────────────────
export { StorageGauge } from "./storage-gauge";

// ── Attendance / time ────────────────────────────────────────────────────
export { CalendarMonth, generateDays, isoDate, isWeekend, sameDay, formatHours } from "./calendar-month";
export type { CalendarMonthProps, CalendarDayData, CalendarDayStatus } from "./calendar-month";
export { Timeline } from "./timeline";
export type { TimelineBlockData, TimelineRowData } from "./timeline";

// ── List views / toolbars ────────────────────────────────────────────────
export { TopBar } from "./top-bar";
export type { TopBarProps } from "./top-bar";
export { ViewPicker } from "./view-picker";
export type { ViewPickerProps, ViewType, ViewPickerOption } from "./view-picker";

// ── Activity / events ────────────────────────────────────────────────────
export { ActivityFeed } from "./activity-feed";

// ── Access control ───────────────────────────────────────────────────────
export { PermissionMultiSelect } from "./permission-multiselect";
