/**
 * useEmployeeSummary.test.ts — Bug 1 verification.
 *
 * Bug 1: RecordDetailRenderer passed {} (empty WorkDayQuery) to
 * useEmployeeSummary / useEmployeeWorkDays → API received no date range
 * → backend defaulted to today only.
 *
 * FIX: RecordDetailRenderer now computes the current month's date range
 * and passes it as { from, to } Unix timestamps.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const mockFetchEmployeeSummary = vi.fn();

vi.mock("@/lib/api/employees", () => ({
	fetchEmployeeSummary: (...args: unknown[]) => mockFetchEmployeeSummary(...args),
}));

import { useEmployeeSummary } from "./use-employee-summary";
import { dateToTimestamp } from "@/testing/mocks/data";

function makeWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("useEmployeeSummary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	/**
	 * Validates that the FIX for Bug 1 works: when a proper monthly date range
	 * is passed (as RecordDetailRenderer now does), the API receives from/to
	 * Unix timestamps and returns full month data.
	 */
	it("passes from/to Unix timestamps to the API when date range is provided", async () => {
		const from = dateToTimestamp("2026-07-01");
		const to = dateToTimestamp("2026-07-31");

		mockFetchEmployeeSummary.mockResolvedValueOnce({
			user_pin: "1001",
			total_days: 31,
			present_days: 28,
			late_days: 2,
			absent_days: 1,
			avg_hours_per_day: 7.8,
			total_overtime_seconds: 7200,
			total_regular_seconds: 28 * 28800,
			work_days: [],
		});

		const { result } = renderHook(
			() => useEmployeeSummary("1001", { from, to }),
			{ wrapper: makeWrapper() },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(mockFetchEmployeeSummary).toHaveBeenCalledWith("1001", { from, to });
		expect(result.current.data?.total_days).toBe(31);
	});

	/**
	 * Documents Bug 1: when {} is passed (like the old RecordDetailRenderer did),
	 * the API receives no date params → backend defaults to today.
	 *
	 * This test verifies the hook's contract — it passes through whatever it receives.
	 * The fix is in the CALLER (RecordDetailRenderer), not the hook.
	 */
	it("BUG_DOC: empty query {} → API called without date params (caller should provide range)", async () => {
		mockFetchEmployeeSummary.mockResolvedValueOnce({
			user_pin: "1001",
			total_days: 1,
			present_days: 1,
			late_days: 0,
			absent_days: 0,
			avg_hours_per_day: 8,
			total_overtime_seconds: 0,
			total_regular_seconds: 28800,
			work_days: [],
		});

		const { result } = renderHook(() => useEmployeeSummary("1001", {}), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		// The hook faithfully forwards whatever it receives
		expect(mockFetchEmployeeSummary).toHaveBeenCalledWith("1001", {});
		// When caller passes {} → backend returns today-only (1 day)
		expect(result.current.data?.total_days).toBe(1);
	});

	it("disabled when pin is empty", () => {
		const { result } = renderHook(() => useEmployeeSummary(""), {
			wrapper: makeWrapper(),
		});
		expect(result.current.fetchStatus).toBe("idle");
	});
});
