/**
 * useAttendanceCalendar.test.ts — Calendar data orchestration hook tests.
 *
 * Covers:
 *  - Calendar endpoint query params (year, month, device_sns, user_pins, status)
 *  - Default behavior: auto-navigation to current month when no year/month
 *  - Derived state: dayStatusMap, employeeStatusesByDay from response
 *  - Employee pin filtering via userPin/userPins
 *  - Response mapping: CalendarEmployeeDay → dayStatus / EmployeeStatusEntry
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { createElement, type ReactNode } from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/attendance", () => ({
	fetchCalendarMonth: vi.fn(),
}));

import { fetchCalendarMonth, type CalendarMonthResponse } from "@/lib/api/attendance";
import { useAttendanceCalendar } from "./use-attendance-calendar";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, { i18n }, children),
		);
	};
}

function mockCalendarResponse(days: CalendarMonthResponse["days"] = {}): CalendarMonthResponse {
	return { year: 2026, month: 7, days };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useAttendanceCalendar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fetchCalendarMonth).mockResolvedValue(mockCalendarResponse());
	});

	// ── Query params ───────────────────────────────────────────────────────

	describe("query params", () => {
		it("calls fetchCalendarMonth with year + month from options", async () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchCalendarMonth).toHaveBeenCalledWith(
					expect.objectContaining({ year: 2026, month: 7 }),
				);
			});
		});

		it("passes deviceSns as device_sns query param", async () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7, deviceSns: "DEV-001" }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchCalendarMonth).toHaveBeenCalledWith(
					expect.objectContaining({ device_sns: "DEV-001" }),
				);
			});
		});

		it("passes status as query param", async () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7, status: "check_in" }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchCalendarMonth).toHaveBeenCalledWith(
					expect.objectContaining({ status: "check_in" }),
				);
			});
		});

		it("passes userPin as user_pins query param", async () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7, userPin: "1001" }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchCalendarMonth).toHaveBeenCalledWith(
					expect.objectContaining({ user_pins: "1001" }),
				);
			});
		});

		it("defaults to today when no year/month provided", () => {
			const today = new Date();
			const { result } = renderHook(
				() => useAttendanceCalendar(),
				{ wrapper: makeWrapper() },
			);

			expect(result.current.year).toBe(today.getFullYear());
			expect(result.current.month).toBe(today.getMonth() + 1);
		});
	});

	// ── Response mapping ──────────────────────────────────────────────────

	describe("response mapping", () => {
		it("builds dayStatusMap from response days", async () => {
			vi.mocked(fetchCalendarMonth).mockResolvedValue(
				mockCalendarResponse({
					"2026-07-01": [
						{ pin: "1", name: "Alice", status: "present", hours: 8, overtime_hours: 0, break_minutes: 30, anomaly_count: 0, is_late: false },
					],
					"2026-07-02": [
						{ pin: "1", name: "Alice", status: "absent", hours: 0, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
					],
				}),
			);

			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.dayStatusMap["2026-07-01"]?.status).toBe("full");
				expect(result.current.dayStatusMap["2026-07-02"]?.status).toBe("absent");
			});
		});

		it("maps 'late' backend status to 'late' cell status", async () => {
			vi.mocked(fetchCalendarMonth).mockResolvedValue(
				mockCalendarResponse({
					"2026-07-01": [
						{ pin: "1", name: "Alice", status: "late", hours: 8, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: true },
					],
				}),
			);

			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.dayStatusMap["2026-07-01"]?.status).toBe("late");
			});
		});

		it("builds employeeStatusesByDay for all-employees mode", async () => {
			vi.mocked(fetchCalendarMonth).mockResolvedValue(
				mockCalendarResponse({
					"2026-07-01": [
						{ pin: "1", name: "Alice", status: "present", hours: 8, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
						{ pin: "2", name: "Bob", status: "absent", hours: 0, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
					],
				}),
			);

			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				const entries = result.current.employeeStatusesByDay.get("2026-07-01");
				expect(entries).toHaveLength(2);
				// Absent should be sorted after present
				expect(entries![0]!.name).toBe("Alice");
				expect(entries![1]!.name).toBe("Bob");
				expect(entries![1]!.status).toBe("absent");
			});
		});

		it("filters out weekend status from employeeStatusesByDay", async () => {
			vi.mocked(fetchCalendarMonth).mockResolvedValue(
				mockCalendarResponse({
					"2026-07-04": [ // Saturday
						{ pin: "1", name: "Alice", status: "weekend", hours: 0, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
					],
				}),
			);

			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				const entries = result.current.employeeStatusesByDay.get("2026-07-04");
				expect(entries).toBeUndefined();
			});
		});

		it("computes aggregate cell status for multiple employees", async () => {
			vi.mocked(fetchCalendarMonth).mockResolvedValue(
				mockCalendarResponse({
					"2026-07-01": [
						{ pin: "1", name: "A", status: "present", hours: 8, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
						{ pin: "2", name: "B", status: "present", hours: 7, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
						{ pin: "3", name: "C", status: "late", hours: 8, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: true },
						{ pin: "4", name: "D", status: "absent", hours: 0, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
					],
				}),
			);

			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				// 3 present out of 4 = 75% (< 80%) → "half"
				// But one is late → "late" takes priority
				expect(result.current.dayStatusMap["2026-07-01"]?.status).toBe("late");
			});
		});

		it("computes avg hours in aggregate mode", async () => {
			vi.mocked(fetchCalendarMonth).mockResolvedValue(
				mockCalendarResponse({
					"2026-07-01": [
						{ pin: "1", name: "A", status: "present", hours: 8, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
						{ pin: "2", name: "B", status: "present", hours: 6, overtime_hours: 0, break_minutes: 0, anomaly_count: 0, is_late: false },
					],
				}),
			);

			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.dayStatusMap["2026-07-01"]?.hours).toBeCloseTo(7, 1);
			});
		});
	});

	// ── Employee pin filtering ─────────────────────────────────────────────

	describe("employee pin filtering", () => {
		it("passes userPin to query params", async () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7, userPin: "1001" }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchCalendarMonth).toHaveBeenCalledWith(
					expect.objectContaining({ user_pins: "1001" }),
				);
			});
		});

		it("userPin takes precedence over userPins", async () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7, userPin: "1001", userPins: ["1002"] }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchCalendarMonth).toHaveBeenCalledWith(
					expect.objectContaining({ user_pins: "1001" }),
				);
			});
		});
	});

	// ── Navigation ─────────────────────────────────────────────────────────

	describe("navigation", () => {
		it("returns year, month, monthLabel from navigation", () => {
			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(7);
			expect(result.current.monthLabel).toContain("2026");
		});
	});
});
