/**
 * useAttendanceCalendar.test.ts — Calendar data orchestration hook tests.
 *
 * Covers:
 *  - Bug 2: Calendar respects page-level filter context (since/until, status, device, search)
 *  - Default behavior: auto-generated date range from year/month ±7 days
 *  - Employee pin filtering via userPin/userPins
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { createElement, type ReactNode } from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/modules/punches/hooks/use-punch-data", () => ({
	usePunchData: vi.fn(),
}));

import { usePunchData } from "@/modules/punches/hooks/use-punch-data";
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useAttendanceCalendar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(usePunchData).mockReturnValue({
			data: { punches: [] },
			isLoading: false,
		} as any);
	});

	// ── Default behavior ────────────────────────────────────────────────────

	describe("default behavior (no external filters)", () => {
		it("generates since/until from year/month ±7 days", () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			// July 2026: since should be June 24 (±7 days around month start)
			expect(filterArg.since).toBe("2026-06-24");
			// July 2026: until should be August 7 (±7 days around month end)
			expect(filterArg.until).toBe("2026-08-07");
		});

		it("generates correct range for January (year boundary)", () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 1 }),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			// January 2026: since should be Dec 25, 2025
			expect(filterArg.since).toBe("2025-12-25");
			// January 2026: until should be Feb 7, 2026
			expect(filterArg.until).toBe("2026-02-07");
		});

		it("defaults to today when no year/month provided", () => {
			const today = new Date();
			const { result } = renderHook(
				() => useAttendanceCalendar(),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			// Year/month should default to current
			expect(result.current.year).toBe(today.getFullYear());
			expect(result.current.month).toBe(today.getMonth() + 1);

			// since/until should be derived from auto-generated year/month ±7
			expect(typeof filterArg.since).toBe("string");
			expect(typeof filterArg.until).toBe("string");
		});
	});

	// ── Bug 2: filter propagation ──────────────────────────────────────────

	describe("Bug 2: calendar respects page-level filter context", () => {
		it("RED: uses filterSince/filterUntil when provided instead of auto-generated range", () => {
			renderHook(
				() =>
					useAttendanceCalendar({
						year: 2026,
						month: 7,
						filterSince: "2026-07-01",
						filterUntil: "2026-07-15",
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			// Should use the explicitly provided range, NOT the ±7 day auto-generated range
			expect(filterArg.since).toBe("2026-07-01");
			expect(filterArg.until).toBe("2026-07-15");
		});

		it("RED: passes filterContext (status, device_sns, search) through to usePunchData", () => {
			renderHook(
				() =>
					useAttendanceCalendar({
						year: 2026,
						month: 7,
						filterContext: {
							status: "check_in",
							device_sns: ["DEV-001"],
							search: "Alice",
						},
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			// Verifies status propagates
			expect(filterArg.status).toBe("check_in");
			// Verifies device_sns propagates
			expect(filterArg.device_sns).toEqual(["DEV-001"]);
			// Verifies search propagates
			expect(filterArg.search).toBe("Alice");
		});

		it("RED: filterContext does NOT override userPin/userPins", () => {
			renderHook(
				() =>
					useAttendanceCalendar({
						year: 2026,
						month: 7,
						userPin: "1001",
						filterContext: {
							status: "check_in",
						},
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			// userPin should still be applied
			expect(filterArg.user_pins).toEqual(["1001"]);
			// status from filterContext should also be applied
			expect(filterArg.status).toBe("check_in");
		});

		it("uses internal since/until when filterSince is undefined but filterUntil is provided", () => {
			// Partial override: only filterUntil provided, since should default to internal
			renderHook(
				() =>
					useAttendanceCalendar({
						year: 2026,
						month: 7,
						filterUntil: "2026-07-15",
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			// since should be auto-generated (only until overridden)
			expect(filterArg.since).toBe("2026-06-24");
			// until should be the provided value
			expect(filterArg.until).toBe("2026-07-15");
		});

		it("uses internal until when filterUntil is undefined but filterSince is provided", () => {
			renderHook(
				() =>
					useAttendanceCalendar({
						year: 2026,
						month: 7,
						filterSince: "2026-07-01",
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;

			expect(filterArg.since).toBe("2026-07-01");
			expect(filterArg.until).toBe("2026-08-07"); // auto-generated
		});
	});

	// ── Employee pin filtering ─────────────────────────────────────────────

	describe("employee pin filtering", () => {
		it("passes userPin to usePunchData as user_pins array", () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7, userPin: "1001" }),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.user_pins).toEqual(["1001"]);
		});

		it("passes userPins[0] as user_pins (backward compat)", () => {
			renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7, userPins: ["1001", "1002"] }),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.user_pins).toEqual(["1001"]);
		});

		it("userPin takes precedence over userPins", () => {
			renderHook(
				() =>
					useAttendanceCalendar({
						year: 2026,
						month: 7,
						userPin: "1001",
						userPins: ["1002"],
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.user_pins).toEqual(["1001"]);
		});
	});

	// ── Derived state ──────────────────────────────────────────────────────

	describe("derived state", () => {
		it("returns year, month, monthLabel from navigation", () => {
			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(7);
			expect(result.current.monthLabel).toContain("2026");
		});

		it("returns since/until matching what was passed to usePunchData", () => {
			const { result } = renderHook(
				() => useAttendanceCalendar({ year: 2026, month: 7 }),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(result.current.since).toBe(filterArg.since);
			expect(result.current.until).toBe(filterArg.until);
		});
	});
});
