/**
 * Attendance module — bounded context for attendance views and computation.
 *
 * Composes employee and punch data into calendar, timeline, and table views.
 * Owns the attendance computation logic (previously scattered across dashboard,
 * employees, and punches modules).
 */

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

export type { AttendanceCalendarViewProps } from "./components/calendar-view";
export type { CalendarToolbarProps } from "./components/calendar-toolbar";
export type { TimelineViewProps, TimelineEmployee } from "./components/timeline-view";
export type { TimelineToolbarProps } from "./components/timeline-toolbar";
export type { AttendanceTableProps, PunchRecord } from "./components/attendance-table";

// ── Hooks ────────────────────────────────────────────────────────────────
export { useAttendanceCalendar } from "./hooks/use-attendance-calendar";
