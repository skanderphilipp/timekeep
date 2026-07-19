/**
 * useEmployeeWorkDays.test.ts — Employee work days hook tests.
 *
 * Covers:
 *  - Bug 1: empty WorkDayQuery {} → API receives no date params → today only
 *  - Proper date range passing
 *  - Query disabling when pin is empty
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ── Mock the API module ─────────────────────────────────────────────────────

const mockFetchEmployeeWorkDays = vi.fn();

vi.mock("@/lib/api/employees", () => ({
	fetchEmployeeWorkDays: (...args: unknown[]) => mockFetchEmployeeWorkDays(...args),
}));

import { useEmployeeWorkDays } from "./use-employee-work-days";
import { dateToTimestamp } from "@/testing/mocks/data";

// ── Wrapper ──────────────────────────────────────────────────────────────────

function makeWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("useEmployeeWorkDays", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── Bug 1: Empty WorkDayQuery ─────────────────────────────────────────────

	describe("Bug 1: empty WorkDayQuery {} → today only", () => {
		it("BUG_DOC: empty query {} → no date params → API returns only today", async () => {
			mockFetchEmployeeWorkDays.mockResolvedValueOnce({
				user_pin: "1001",
				work_days: [
					{
						date: new Date().toISOString().split("T")[0],
						user_pin: "1001",
						status: "present",
						total_regular_seconds: 28800,
						total_break_seconds: 1800,
						total_overtime_seconds: 0,
						net_work_seconds: 28800,
						is_present_now: false,
						anomaly_count: 0,
						periods: [],
					},
				],
			});

			const { result } = renderHook(() => useEmployeeWorkDays("1001", {}), {
				wrapper: makeWrapper(),
			});

			await waitFor(() => expect(result.current.isSuccess).toBe(true));

			// BUG: only 1 work day (today) because no date range was passed
			expect(result.current.data?.work_days.length).toBe(1);
			expect(mockFetchEmployeeWorkDays).toHaveBeenCalledWith("1001", {});
		});

		it("FIX_TEST: with proper date range → full month of work days", async () => {
			const from = dateToTimestamp("2026-07-01");
			const to = dateToTimestamp("2026-07-31");

			const workDays31 = Array.from({ length: 31 }, (_, i) => ({
				date: `2026-07-${String(i + 1).padStart(2, "0")}`,
				user_pin: "1001",
				status: "present" as const,
				total_regular_seconds: 28800,
				total_break_seconds: 1800,
				total_overtime_seconds: 0,
				net_work_seconds: 28800,
				is_present_now: false,
				anomaly_count: 0,
				periods: [],
			}));

			mockFetchEmployeeWorkDays.mockResolvedValueOnce({
				user_pin: "1001",
				work_days: workDays31,
			});

			const { result } = renderHook(
				() => useEmployeeWorkDays("1001", { from, to }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => expect(result.current.isSuccess).toBe(true));

			// CORRECT: 31 work days for July
			expect(result.current.data?.work_days.length).toBe(31);
			expect(mockFetchEmployeeWorkDays).toHaveBeenCalledWith("1001", { from, to });
		});

		it("FIX_TEST: undefined query → undefined passed to API (backend defaults to today)", async () => {
			mockFetchEmployeeWorkDays.mockResolvedValueOnce({
				user_pin: "1001",
				work_days: [],
			});

			const { result } = renderHook(() => useEmployeeWorkDays("1001"), {
				wrapper: makeWrapper(),
			});

			await waitFor(() => expect(result.current.isSuccess).toBe(true));

			expect(mockFetchEmployeeWorkDays).toHaveBeenCalledWith("1001", undefined);
		});
	});

	// ── Basic behavior ────────────────────────────────────────────────────────

	describe("basic behavior", () => {
		it("is disabled when pin is empty", () => {
			const { result } = renderHook(() => useEmployeeWorkDays(""), {
				wrapper: makeWrapper(),
			});

			expect(result.current.fetchStatus).toBe("idle");
			expect(mockFetchEmployeeWorkDays).not.toHaveBeenCalled();
		});

		it("returns loading state when pin is valid", () => {
			mockFetchEmployeeWorkDays.mockReturnValue(new Promise(() => {}));

			const { result } = renderHook(() => useEmployeeWorkDays("1001", {
				from: dateToTimestamp("2026-07-01"),
				to: dateToTimestamp("2026-07-31"),
			}), { wrapper: makeWrapper() });

			expect(result.current.isLoading).toBe(true);
		});

		it("handles empty work days array", async () => {
			mockFetchEmployeeWorkDays.mockResolvedValueOnce({
				user_pin: "1001",
				work_days: [],
			});

			const { result } = renderHook(() => useEmployeeWorkDays("1001", {
				from: dateToTimestamp("2026-07-01"),
				to: dateToTimestamp("2026-07-01"),
			}), { wrapper: makeWrapper() });

			await waitFor(() => expect(result.current.isSuccess).toBe(true));
			expect(result.current.data?.work_days).toEqual([]);
		});
	});
});
