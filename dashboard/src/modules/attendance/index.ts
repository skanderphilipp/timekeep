/**
 * Attendance module — bounded context for attendance views and computation.
 *
 * Composes employee and punch data into calendar, timeline, and table views.
 * Owns the attendance computation logic (previously scattered across dashboard,
 * employees, and punches modules).
 */

// ── Types ─────────────────────────────────────────────────────────────────
export type { TimelineEmployee } from "./types";

// ── Constants ────────────────────────────────────────────────────────────
export { HOUR_MARKERS } from "./constants/hour-markers";

// ── Computation (pure logic, zero React) ─────────────────────────────────
export {
	classifyDayFromPunches,
	aggregateDayStatus,
	buildBlocks,
	buildLegendItems,
	computeAttendanceSummary,
	statusLabel,
	formatDuration,
} from "./compute";
export type {
	CalendarDayStatus,
	TimelineBlock,
	TimelineBlockColor,
	AttendanceSummary,
	AttendanceEvent,
	DayAggregation,
} from "./compute";

// ── Components ───────────────────────────────────────────────────────────
export { AttendanceCalendarView, createCalendarRenderView } from "./components/calendar-view";
export { CalendarToolbar } from "./components/calendar-toolbar";
export { AttendanceTimelineView } from "./components/timeline-view";
export { TimelineToolbar } from "./components/timeline-toolbar";
export { AttendanceTable } from "./components/attendance-table";
export { EmployeeAttendanceSummary } from "./components/employee-attendance-summary";
export { DayDetailPanel } from "./components/day-detail-panel";
export { MiniStatusBars } from "./components/mini-status-bars";

export type { AttendanceCalendarViewProps } from "./components/calendar-view";
export type { CalendarToolbarProps } from "./components/calendar-toolbar";
export type { TimelineViewProps } from "./components/timeline-view";
export type { TimelineToolbarProps } from "./components/timeline-toolbar";
export type { AttendanceTableProps, PunchRecord } from "./components/attendance-table";
export type { EmployeeAttendanceSummaryProps } from "./components/employee-attendance-summary";
export type { DayDetailPanelProps } from "./components/day-detail-panel";
export type { MiniStatusBarsProps, EmployeeStatusEntry } from "./components/mini-status-bars";

// ── Hooks ────────────────────────────────────────────────────────────────
export { useAttendanceCalendar } from "./hooks/use-attendance-calendar";
export { useCalendarNavigation } from "./hooks/use-calendar-navigation";
export { useTimelineDate } from "./hooks/use-timeline-date";
export { usePunchBlocks } from "./hooks/use-punch-blocks";

export type { UseAttendanceCalendarOptions, EmployeeOption } from "./hooks/use-attendance-calendar";
export type { UsePunchBlocksOptions, UsePunchBlocksResult } from "./hooks/use-punch-blocks";
