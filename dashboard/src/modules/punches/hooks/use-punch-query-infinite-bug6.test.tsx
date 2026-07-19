/**
 * usePunchQueryInfinite — Bug 6: clear filters re-arms today default.
 *
 * RED TEST: After handleClearFilters(), date range should be EMPTY,
 * not reset to today. Currently the initializedRef is re-armed,
 * causing the useEffect to set today's date range immediately.
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ── Mock useInfinitePunchData ────────────────────────────────────────────────

vi.mock("./use-punch-data-infinite", () => ({
	useInfinitePunchData: vi.fn(() => ({
		data: { pages: [{ punches: [] }] },
		isLoading: false,
		isFetchingNextPage: false,
		hasNextPage: false,
		fetchNextPage: vi.fn(),
		error: null,
		refetch: vi.fn(),
	})),
}));

import { useInfinitePunchQuery } from "./use-punch-query-infinite";

function makeWrapper(initialUrl = "/") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			MemoryRouter,
			{ initialEntries: [initialUrl] },
			createElement(QueryClientProvider, { client: queryClient }, children),
		);
	};
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("useInfinitePunchQuery — Bug 6: clear filters re-arms today", () => {
	/**
	 * RED TEST: After calling handleClearFilters(), the date range
	 * should be CLEARED (empty strings), not reset to today.
	 *
	 * CURRENT BEHAVIOR (BUG): handleClearFilters sets initializedRef.current = false,
	 * which causes the useEffect to re-fire and set today's date.
	 * After fix: date range should remain empty after clear.
	 */
	it("RED: clearFilters should clear date range, not reset to today", () => {
		const { result } = renderHook(
			() => useInfinitePunchQuery(),
			{
				wrapper: makeWrapper(
					"/?punches_since=2026-06-01&punches_until=2026-06-30&punches_status=check_in",
				),
			},
		);

		// Initial state from URL
		expect(result.current.filters.since).toBe("2026-06-01");
		expect(result.current.filters.until).toBe("2026-06-30");
		expect(result.current.filters.status).toBe("check_in");

		act(() => {
			result.current.handleClearFilters();
		});

		// EXPECTED after fix: all filters cleared, date range empty
		expect(result.current.filters.status).toBe("");
		expect(result.current.filters.since).toBe("");
		expect(result.current.filters.until).toBe("");
	});
});
