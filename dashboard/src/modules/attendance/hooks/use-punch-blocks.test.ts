/**
 * usePunchBlocks.test.ts — Timeline data hook tests.
 *
 * Covers:
 *  - Timeline endpoint query params (date, device_sns, status)
 *  - Response mapping: TimelineEmployeeBlocks → rows, employeeList
 *  - Legend items generation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/attendance", () => ({
	fetchTimelineDay: vi.fn(),
}));

import { fetchTimelineDay, type TimelineDayResponse } from "@/lib/api/attendance";
import { usePunchBlocks } from "./use-punch-blocks";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

const mockTranslate = (key: string) => key;

function mockTimelineResponse(
	employees: TimelineDayResponse["employees"] = [],
): TimelineDayResponse {
	return { date: "2026-07-19", employees };
}

function makeEmployee(overrides: Partial<TimelineDayResponse["employees"][number]> = {}) {
	return {
		pin: "1",
		name: "Alice",
		blocks: [],
		status: "present",
		hours: 8,
		overtime_hours: 0,
		break_minutes: 30,
		anomaly_count: 0,
		is_late: false,
		...overrides,
	};
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("usePunchBlocks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fetchTimelineDay).mockResolvedValue(mockTimelineResponse());
	});

	// ── Query params ───────────────────────────────────────────────────────

	describe("query params", () => {
		it("calls fetchTimelineDay with date in ISO format", async () => {
			renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: mockTranslate }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchTimelineDay).toHaveBeenCalledWith(
					expect.objectContaining({ date: "2026-07-19" }),
				);
			});
		});

		it("passes deviceSns as device_sns query param", async () => {
			renderHook(
				() =>
					usePunchBlocks({
						date: new Date("2026-07-19"),
						deviceSns: "DEV-001",
						translate: mockTranslate,
					}),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchTimelineDay).toHaveBeenCalledWith(
					expect.objectContaining({ device_sns: "DEV-001" }),
				);
			});
		});

		it("passes status query param", async () => {
			renderHook(
				() =>
					usePunchBlocks({
						date: new Date("2026-07-19"),
						status: "check_in",
						translate: mockTranslate,
					}),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(fetchTimelineDay).toHaveBeenCalledWith(
					expect.objectContaining({ status: "check_in" }),
				);
			});
		});
	});

	// ── Response mapping ──────────────────────────────────────────────────

	describe("response mapping", () => {
		it("maps employees to rows with correct structure", async () => {
			vi.mocked(fetchTimelineDay).mockResolvedValue(
				mockTimelineResponse([
					makeEmployee({
						pin: "123",
						name: "Alice",
						blocks: [
							{ left: 33.3, width: 37.5, color: "present", title: "Check In: 08:00 - 17:00" },
						],
					}),
				]),
			);

			const { result } = renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: mockTranslate }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.rows).toHaveLength(1);
				expect(result.current.rows[0]!.id).toBe("123");
				expect(result.current.rows[0]!.name).toBe("Alice");
				expect(result.current.rows[0]!.subLabel).toBe("123");
				expect(result.current.rows[0]!.blocks).toHaveLength(1);
				expect(result.current.rows[0]!.blocks[0]!.color).toBe("present");
			});
		});

		it("preserves backend sort order", async () => {
			vi.mocked(fetchTimelineDay).mockResolvedValue(
				mockTimelineResponse([
					makeEmployee({ pin: "2", name: "Bob" }),
					makeEmployee({ pin: "1", name: "Alice" }),
				]),
			);

			const { result } = renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: mockTranslate }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.rows).toHaveLength(2);
				// Hook preserves backend order (backend sorts alphabetically)
				expect(result.current.rows[0]!.name).toBe("Bob");
				expect(result.current.rows[1]!.name).toBe("Alice");
			});
		});

		it("builds employeeList from response when no employees prop", async () => {
			vi.mocked(fetchTimelineDay).mockResolvedValue(
				mockTimelineResponse([
					makeEmployee({ pin: "1", name: "Alice" }),
					makeEmployee({ pin: "2", name: "Bob" }),
				]),
			);

			const { result } = renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: mockTranslate }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.employeeList).toHaveLength(2);
				expect(result.current.employeeList[0]!.pin).toBe("1");
			});
		});

		it("uses provided employees prop over response data", async () => {
			vi.mocked(fetchTimelineDay).mockResolvedValue(
				mockTimelineResponse([makeEmployee({ pin: "1", name: "Alice" })]),
			);

			const { result } = renderHook(
				() =>
					usePunchBlocks({
						date: new Date("2026-07-19"),
						employees: [{ pin: "99", name: "Custom" }],
						translate: mockTranslate,
					}),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.employeeList).toHaveLength(1);
				expect(result.current.employeeList[0]!.pin).toBe("99");
			});
		});

		it("returns empty rows for empty response", async () => {
			const { result } = renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: mockTranslate }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.rows).toHaveLength(0);
				expect(result.current.employeeList).toHaveLength(0);
			});
		});
	});

	// ── Legend ────────────────────────────────────────────────────────────

	describe("legend", () => {
		it("returns translated legend items", () => {
			const customTranslate = (key: string) => `__${key}__`;

			const { result } = renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: customTranslate }),
				{ wrapper: makeWrapper() },
			);

			expect(result.current.legendItems).toEqual([
				{ color: "present", label: "__Present__" },
				{ color: "warning", label: "__Break__" },
				{ color: "overtime", label: "__Overtime__" },
			]);
		});
	});

	// ── Loading state ─────────────────────────────────────────────────────

	describe("loading state", () => {
		it("isLoading is true while fetching", () => {
			vi.mocked(fetchTimelineDay).mockReturnValue(new Promise(() => {})); // never resolves

			const { result } = renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: mockTranslate }),
				{ wrapper: makeWrapper() },
			);

			expect(result.current.isLoading).toBe(true);
		});
	});

	// ── Employee data for side panel ──────────────────────────────────────

	describe("employeeData", () => {
		it("returns raw employee data for side panel use", async () => {
			vi.mocked(fetchTimelineDay).mockResolvedValue(
				mockTimelineResponse([
					makeEmployee({
						pin: "1",
						name: "Alice",
						hours: 8.5,
						overtime_hours: 1,
						break_minutes: 30,
						anomaly_count: 2,
						is_late: true,
					}),
				]),
			);

			const { result } = renderHook(
				() => usePunchBlocks({ date: new Date("2026-07-19"), translate: mockTranslate }),
				{ wrapper: makeWrapper() },
			);

			await waitFor(() => {
				expect(result.current.employeeData).toHaveLength(1);
				const emp = result.current.employeeData[0]!;
				expect(emp.pin).toBe("1");
				expect(emp.hours).toBe(8.5);
				expect(emp.overtime_hours).toBe(1);
				expect(emp.anomaly_count).toBe(2);
			});
		});
	});
});
