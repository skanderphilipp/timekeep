/**
 * useCalendarNavigation.test.ts — Calendar month navigation hook tests.
 *
 * Covers:
 *  - Uncontrolled mode: prev/next/today/year navigation
 *  - Controlled mode: external year/month sync
 *  - Month boundary wrapping (Dec→Jan, Jan→Dec)
 *  - Bug 5: controlled mode — navigation persists without useEffect reversion
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCalendarNavigation } from "./use-calendar-navigation";

describe("useCalendarNavigation", () => {
	// ── Uncontrolled mode  ──────────────────────────────────────────────────

	describe("uncontrolled mode (no year/month props)", () => {
		it("initializes to current month/year when no props given", () => {
			const today = new Date();
			const { result } = renderHook(() => useCalendarNavigation());

			expect(result.current.year).toBe(today.getFullYear());
			expect(result.current.month).toBe(today.getMonth() + 1);
		});

		it("goPrev decrements month within same year", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 7 }),
			);

			act(() => result.current.goPrev());
			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(6);
		});

		it("goPrev wraps from January to December of previous year", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 1 }),
			);

			act(() => result.current.goPrev());
			expect(result.current.year).toBe(2025);
			expect(result.current.month).toBe(12);
		});

		it("goNext increments month within same year", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 7 }),
			);

			act(() => result.current.goNext());
			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(8);
		});

		it("goNext wraps from December to January of next year", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 12 }),
			);

			act(() => result.current.goNext());
			expect(result.current.year).toBe(2027);
			expect(result.current.month).toBe(1);
		});

		it("goToday resets to current month/year", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2020, month: 3 }),
			);

			act(() => result.current.goToday());
			const today = new Date();
			expect(result.current.year).toBe(today.getFullYear());
			expect(result.current.month).toBe(today.getMonth() + 1);
		});

		it("goPrevYear decrements year, keeps same month", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 7 }),
			);

			act(() => result.current.goPrevYear());
			expect(result.current.year).toBe(2025);
			expect(result.current.month).toBe(7);
		});

		it("goNextYear increments year, keeps same month", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 7 }),
			);

			act(() => result.current.goNextYear());
			expect(result.current.year).toBe(2027);
			expect(result.current.month).toBe(7);
		});

		it("monthLabel produces localized month name", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 7 }),
			);

			expect(result.current.monthLabel).toContain("2026");
			expect(result.current.monthLabel).toContain("July");
		});

		it("goPrev from February (non-leap year boundary)", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 2 }),
			);

			act(() => result.current.goPrev());
			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(1);
		});
	});

	// ── Controlled mode ─────────────────────────────────────────────────────

	describe("controlled mode (year + month props)", () => {
		it("syncs to external year/month changes", () => {
			const { result, rerender } = renderHook(
				({ year, month }) => useCalendarNavigation({ year, month }),
				{ initialProps: { year: 2026, month: 7 } },
			);

			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(7);

			rerender({ year: 2025, month: 3 });
			expect(result.current.year).toBe(2025);
			expect(result.current.month).toBe(3);
		});

		it("reports isControlled=true", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 7 }),
			);

			expect(result.current.isControlled).toBe(true);
		});

		it("reports isControlled=false when no props", () => {
			const { result } = renderHook(() => useCalendarNavigation());

			expect(result.current.isControlled).toBe(false);
		});

		/**
		 * Bug 5 fix: Controlled mode navigation persists.
		 *
		 * Previously, goPrev/goNext in controlled mode updated internal state
		 * but a useEffect would re-sync to parent props on re-render, causing
		 * the navigation to be reverted. Now the ref-based sync prevents this.
		 */
		it("Bug 5 FIX: goPrev in controlled mode persists (no useEffect reversion)", () => {
			const { result, rerender } = renderHook(
				({ year, month }) => useCalendarNavigation({ year, month }),
				{ initialProps: { year: 2026, month: 7 } },
			);

			act(() => result.current.goPrev());
			expect(result.current.month).toBe(6);
			expect(result.current.year).toBe(2026);

			// Simulate parent re-render with same props (e.g., filter change)
			// Navigation should NOT be reverted
			rerender({ year: 2026, month: 7 });
			expect(result.current.month).toBe(6);
			expect(result.current.year).toBe(2026);
		});

		it("Bug 5 FIX: goNext persists after parent re-render", () => {
			const { result, rerender } = renderHook(
				({ year, month }) => useCalendarNavigation({ year, month }),
				{ initialProps: { year: 2026, month: 7 } },
			);

			act(() => result.current.goNext());
			expect(result.current.month).toBe(8);

			rerender({ year: 2026, month: 7 });
			expect(result.current.month).toBe(8);
		});

		it("Bug 5 FIX: goToday persists after parent re-render", () => {
			const { result, rerender } = renderHook(
				({ year: _year, month: _month }) => useCalendarNavigation({ year: 2020, month: 3 }),
				{ initialProps: { year: 2020, month: 3 } },
			);

			act(() => result.current.goToday());
			const today = new Date();
			expect(result.current.month).toBe(today.getMonth() + 1);

			// Re-render with old props should not revert
			rerender({ year: 2020, month: 3 });
			expect(result.current.month).toBe(today.getMonth() + 1);
		});

		it("Bug 5 FIX: still syncs when parent CHANGES props (not same props)", () => {
			const { result, rerender } = renderHook(
				({ year, month }) => useCalendarNavigation({ year, month }),
				{ initialProps: { year: 2026, month: 7 } },
			);

			// Navigate
			act(() => result.current.goPrev());
			expect(result.current.month).toBe(6);

			// Parent changes to a different month (e.g., user changes date filter)
			rerender({ year: 2026, month: 9 });
			expect(result.current.month).toBe(9);
			expect(result.current.year).toBe(2026);
		});
	});

	// ── Edge cases ───────────────────────────────────────────────────────────

	describe("edge cases", () => {
		it("only year provided (not month) — still uncontrolled", () => {
			const { result } = renderHook(() => useCalendarNavigation({ year: 2026 }));
			expect(result.current.isControlled).toBe(false);
		});

		it("only month provided (not year) — still uncontrolled", () => {
			const { result } = renderHook(() => useCalendarNavigation({ month: 7 }));
			expect(result.current.isControlled).toBe(false);
		});

		it("multiple rapid navigation calls don't lose state", () => {
			const { result } = renderHook(() =>
				useCalendarNavigation({ year: 2026, month: 7 }),
			);

			act(() => {
				result.current.goPrev();
				result.current.goPrev();
				result.current.goPrev();
			});

			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(4);
		});

		it("year boundary navigation: Dec→Jan (forward) and Jan→Dec (backward)", () => {
			const { result, rerender } = renderHook(
				({ year, month }) => useCalendarNavigation({ year, month }),
				{ initialProps: { year: 2026, month: 12 } },
			);

			act(() => result.current.goNext());
			expect(result.current.year).toBe(2027);
			expect(result.current.month).toBe(1);

			rerender({ year: 2027, month: 1 });

			act(() => result.current.goPrev());
			expect(result.current.year).toBe(2026);
			expect(result.current.month).toBe(12);
		});
	});
});
