/**
 * Browser smoke test for the Reports page.
 *
 * Verifies the page renders without crashing in a real browser
 * and loads data via the default current-month date range.
 *
 * Run: pnpm test:browser
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

import { ReportsView } from "../components/reports-view";
import type { ReportSummary } from "@/lib/api";

// ── Hoisted mock data ────────────────────────────────────────────────────

const { mockReportSummary } = vi.hoisted(() => ({
  mockReportSummary: {
    date_from: Math.floor(Date.now() / 1000) - 86400 * 30,
    date_to: Math.floor(Date.now() / 1000),
    total_punches: 847,
    check_ins: 423,
    check_outs: 420,
    break_outs: 187,
    break_ins: 186,
    overtime_ins: 24,
    overtime_outs: 24,
    unique_users: 42,
    work_days: 22,
    avg_seconds_per_day: 29520,
    overtime_seconds: 43200,
    absence_rate: 3.8,
    daily_breakdown: [
      { date: Math.floor(Date.now() / 1000) - 86400, count: 42 },
    ],
    daily_hours: [
      {
        date: Math.floor(Date.now() / 1000) - 86400,
        regular_seconds: 28800,
        overtime_seconds: 1800,
      },
    ],
    weekly_hours: [{ week: 29, year: 2026, total_seconds: 184320 }],
    status_distribution: [
      { status: "full", count: 780, percentage: 85.2 },
      { status: "half", count: 72, percentage: 7.9 },
      { status: "absent", count: 63, percentage: 6.9 },
    ],
    employees: [
      {
        user_pin: "145",
        employee_name: "Ahmed Al-Sabah",
        days_present: 20,
        days_absent: 2,
        days_late: 1,
        avg_seconds_per_day: 29880,
        overtime_seconds: 12600,
        anomaly_count: 0,
      },
    ],
  } satisfies ReportSummary,
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchReportSummary: vi.fn().mockResolvedValue(mockReportSummary),
    fetchPunches: vi.fn().mockResolvedValue({ punches: [] }),
  };
});

// ── Render helper ────────────────────────────────────────────────────────

function renderReportsView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <BrowserRouter>
          <ReportsView />
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("ReportsView — browser smoke test", () => {
  it("renders the heading", () => {
    renderReportsView();
    expect(screen.getByRole("heading", { name: /reports/i })).toBeInTheDocument();
  });

  it("loads and displays punch count from the auto-applied default date range", async () => {
    renderReportsView();

    await waitFor(
      () => {
        expect(screen.getByText("847")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows employee KPIs", async () => {
    renderReportsView();

    await waitFor(() => {
      expect(screen.getByText("Ahmed Al-Sabah")).toBeInTheDocument();
    });
  });

  it("does not show the empty date range placeholder", () => {
    renderReportsView();

    // The "Select date range…" placeholder should NOT appear
    // because the current month is auto-selected as default.
    expect(screen.queryByText(/select date range/i)).not.toBeInTheDocument();
  });
});
