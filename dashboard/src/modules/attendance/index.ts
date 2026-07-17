/**
 * Attendance module — bounded context for attendance views and computation.
 *
 * Composes employee and punch data into calendar, timeline, and table views.
 * Owns the attendance computation logic (previously scattered across dashboard,
 * employees, and punches modules).
 *
 * Consumers:
 * - dashboard/  — composes attendance widgets
 * - employees/   — employee detail calendar (via hooks)
 * - punches/     — punch query page (via timeline/calendar views)
 */

// ── Computation (pure logic, zero React) ─────────────────────────────────
export {
  classifyDayFromPunches,
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
} from "./compute";

// ── Components ───────────────────────────────────────────────────────────
export { AttendanceCalendarView, createCalendarRenderView } from "./components/calendar-view";
export { AttendanceTimelineView } from "./components/timeline-view";
export type { TimelineViewProps, TimelineEmployee } from "./components/timeline-view";
export { AttendanceTable } from "./components/attendance-table";
export type { AttendanceTableProps, PunchRecord } from "./components/attendance-table";

// ── Hooks ────────────────────────────────────────────────────────────────
export { useAttendanceCalendar } from "./hooks/use-attendance-calendar";
