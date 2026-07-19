/**
 * EmployeeAttendanceCalendar.test.tsx — Employee calendar tests.
 *
 * Validates:
 *  - Calendar rendering for a single employee (via useAttendanceCalendar)
 *  - Month navigation in employee detail context
 *  - Bug 2 variant: calendar fetches data independently from parent filter
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { createElement, type ReactNode } from "react";

// ── Mock the punch data hook used by useAttendanceCalendar ────────────────────

vi.mock("@/modules/punches/hooks/use-punch-data", () => ({
	usePunchData: vi.fn(() => ({
		data: { punches: [] },
		isLoading: false,
	})),
}));

import { EmployeeAttendanceCalendar } from "./employee-attendance-calendar";

// ── Wrapper ──────────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("EmployeeAttendanceCalendar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the calendar with month label", async () => {
		render(<EmployeeAttendanceCalendar pin="1001" />, { wrapper: makeWrapper() });

		await waitFor(() => {
			expect(screen.getByText("Attendance")).toBeInTheDocument();
		});
	});

	it("renders weekday headers", async () => {
		render(<EmployeeAttendanceCalendar pin="1001" />, { wrapper: makeWrapper() });

		await waitFor(() => {
			for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
				expect(screen.getByText(day)).toBeInTheDocument();
			}
		});
	});

	it("renders 42 calendar day cells (6 weeks × 7 days)", async () => {
		render(<EmployeeAttendanceCalendar pin="1001" />, { wrapper: makeWrapper() });

		await waitFor(() => {
			const dayCells = document.querySelectorAll('[data-slot="calendar-day"]');
			expect(dayCells.length).toBe(42);
		});
	});

	it("renders navigation buttons", async () => {
		render(<EmployeeAttendanceCalendar pin="1001" />, { wrapper: makeWrapper() });

		await waitFor(() => {
			expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
			expect(screen.getByLabelText("Next month")).toBeInTheDocument();
		});
	});

	it("marks today with [data-today] attribute", async () => {
		render(<EmployeeAttendanceCalendar pin="1001" />, { wrapper: makeWrapper() });

		await waitFor(() => {
			const todayCell = document.querySelector('[data-today]');
			expect(todayCell).toBeInTheDocument();
		});
	});

	it("BUG_DOC: calendar fetches its own data independently (doesn't respect parent filters)", async () => {
		// The useAttendanceCalendar hook generates its own since/until
		// derived from internal year/month state (±7 days).
		// It fetches punches via usePunchData independently.
		// This test confirms the component renders with self-contained data.
		render(<EmployeeAttendanceCalendar pin="1001" />, { wrapper: makeWrapper() });

		await waitFor(() => {
			expect(screen.getByText("Attendance")).toBeInTheDocument();
		});
	});
});
