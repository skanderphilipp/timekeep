/**
 * Timeline data fetching — date precedence contract + Bug 3 filter propagation.
 *
 * Validates Issue #6 fix: when `filterSince`/`filterUntil` are NOT provided,
 * `usePunchBlocks` MUST compute the date range from the local `date` prop.
 * This ensures the timeline can navigate independently of parent page filters.
 *
 * Bug 3: when `filterContext` is provided, its values MUST be propagated
 * to `usePunchData` so timeline data matches page-level filters.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePunchBlocks } from "./use-punch-blocks";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/modules/punches/hooks/use-punch-data", () => ({
	usePunchData: vi.fn(),
}));

import { usePunchData } from "@/modules/punches/hooks/use-punch-data";

function mockTranslate(key: string): string {
	return key;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("usePunchBlocks — date precedence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(usePunchData).mockReturnValue({
			data: { punches: [] },
			isLoading: false,
		} as any);
	});

	it("uses local date when filterSince/filterUntil are NOT provided", () => {
		const date = new Date("2026-07-15T12:00:00Z");

		renderHook(
			() =>
				usePunchBlocks({
					date,
					translate: mockTranslate,
				}),
			{ wrapper: makeWrapper() },
		);

		expect(usePunchData).toHaveBeenCalled();
		const filterArg = vi.mocked(usePunchData).mock.calls[0][0];
		expect(filterArg.since).toBe("2026-07-15");
		expect(filterArg.until).toBe("2026-07-16");
	});

	it("uses filterSince when provided (legacy parent sync)", () => {
		const date = new Date("2026-07-15T12:00:00Z");

		renderHook(
			() =>
				usePunchBlocks({
					date,
					filterSince: "2026-06-01",
					filterUntil: "2026-06-30",
					translate: mockTranslate,
				}),
			{ wrapper: makeWrapper() },
		);

		const filterArg = vi.mocked(usePunchData).mock.calls[0][0];
		expect(filterArg.since).toBe("2026-06-01");
		expect(filterArg.until).toBe("2026-06-30");
	});

	it("computes different date range when date changes", () => {
		const date1 = new Date("2026-07-15T12:00:00Z");

		const { rerender } = renderHook(
			({ date }) =>
				usePunchBlocks({
					date,
					translate: mockTranslate,
				}),
			{
				wrapper: makeWrapper(),
				initialProps: { date: date1 },
			},
		);

		expect(vi.mocked(usePunchData).mock.calls[0][0].since).toBe("2026-07-15");

		const date2 = new Date("2026-07-16T12:00:00Z");
		rerender({ date: date2 });

		expect(vi.mocked(usePunchData).mock.calls[1][0].since).toBe("2026-07-16");
		expect(vi.mocked(usePunchData).mock.calls[1][0].until).toBe("2026-07-17");
	});

	// ── Bug 3: filter context propagation ─────────────────────────────────

	describe("Bug 3: filterContext propagation to usePunchData", () => {
		it("passes filterContext status to usePunchData", () => {
			const date = new Date("2026-07-15T12:00:00Z");

			renderHook(
				() =>
					usePunchBlocks({
						date,
						translate: mockTranslate,
						filterContext: { status: "check_in" },
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.status).toBe("check_in");
		});

		it("passes filterContext device_sns to usePunchData", () => {
			const date = new Date("2026-07-15T12:00:00Z");

			renderHook(
				() =>
					usePunchBlocks({
						date,
						translate: mockTranslate,
						filterContext: { device_sns: ["DEV-001", "DEV-002"] },
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.device_sns).toEqual(["DEV-001", "DEV-002"]);
		});

		it("passes filterContext search to usePunchData", () => {
			const date = new Date("2026-07-15T12:00:00Z");

			renderHook(
				() =>
					usePunchBlocks({
						date,
						translate: mockTranslate,
						filterContext: { search: "Alice" },
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.search).toBe("Alice");
		});

		it("combines filterContext with filterSince/filterUntil", () => {
			const date = new Date("2026-07-15T12:00:00Z");

			renderHook(
				() =>
					usePunchBlocks({
						date,
						filterSince: "2026-07-01",
						filterUntil: "2026-07-31",
						filterContext: { status: "check_out", verify_mode: "fingerprint" },
						translate: mockTranslate,
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.since).toBe("2026-07-01");
			expect(filterArg.until).toBe("2026-07-31");
			expect(filterArg.status).toBe("check_out");
			expect(filterArg.verify_mode).toBe("fingerprint");
		});

		it("undefined filterContext values are present-but-undefined (JS spread behavior)", () => {
			const date = new Date("2026-07-15T12:00:00Z");

			renderHook(
				() =>
					usePunchBlocks({
						date,
						translate: mockTranslate,
						filterContext: { status: "check_in", device_sns: undefined },
					}),
				{ wrapper: makeWrapper() },
			);

			const filterArg = vi.mocked(usePunchData).mock.calls[0]![0]!;
			expect(filterArg.status).toBe("check_in");
			// device_sns key exists but value is undefined — acceptable, API layer strips it
			expect(filterArg.device_sns).toBeUndefined();
		});
	});
});
