import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { createElement, type ReactNode } from "react";

import { useReportsPage } from "./use-reports-page";
import { toDateString } from "@/lib/date";

// ── vi.hoisted() mock data (compatible with vi.mock hoisting) ────────────

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
    daily_breakdown: [],
    daily_hours: [],
    weekly_hours: [],
    status_distribution: [],
    employees: [],
  },
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchReportSummary: vi.fn().mockResolvedValue(mockReportSummary),
    fetchPunches: vi.fn().mockResolvedValue({ punches: [] }),
  };
});

// ── Wrapper ─────────────────────────────────────────────────────────────

function createWrapper(initialUrl = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        I18nProvider,
        { i18n },
        createElement(MemoryRouter, { initialEntries: [initialUrl] }, children),
      ),
    );
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function expectedDefaultRange() {
  const now = new Date();
  return {
    date_from: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    date_to: toDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("useReportsPage — default date range UX", () => {
  describe("on first visit (no URL params)", () => {
    it("defaults filters to the current calendar month", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      const expected = expectedDefaultRange();
      expect(result.current.filters.date_from).toBe(expected.date_from);
      expect(result.current.filters.date_to).toBe(expected.date_to);
    });

    it("reports hasActiveFilters as false when viewing the default month", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("has an empty activeFilters array when viewing the default month", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      expect(result.current.activeFilters).toHaveLength(0);
    });

    it("loads report data on mount (no manual date selection needed)", async () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      await vi.waitFor(() => {
        expect(result.current.summary).toBeDefined();
      });
      expect(result.current.summary?.total_punches).toBe(847);
    });
  });

  describe("when user changes the date range", () => {
    it("reports hasActiveFilters as true after selecting a different month", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setFilter({ date_from: "2026-01-01", date_to: "2026-01-31" });
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("shows active filter chips when date differs from default", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setFilter({ date_from: "2026-01-01", date_to: "2026-01-31" });
      });

      expect(result.current.activeFilters.length).toBeGreaterThan(0);
      expect(result.current.activeFilters.some((f) => f.key === "date_from")).toBe(true);
    });

    it("filters survive in URL params after setting", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setFilter({ date_from: "2026-01-01" });
      });

      expect(result.current.filters.date_from).toBe("2026-01-01");
      const expected = expectedDefaultRange();
      expect(result.current.filters.date_to).toBe(expected.date_to);
    });
  });

  describe("when user clears filters", () => {
    it("resets to current month after clearing", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setFilter({ date_from: "2025-06-01", date_to: "2025-06-30" });
      });
      expect(result.current.filters.date_from).toBe("2025-06-01");

      act(() => {
        result.current.resetFilters();
      });

      const expected = expectedDefaultRange();
      expect(result.current.filters.date_from).toBe(expected.date_from);
      expect(result.current.filters.date_to).toBe(expected.date_to);
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe("when visiting with existing URL params", () => {
    it("uses URL params over the default month range", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper("/?reports_date_from=2025-03-01&reports_date_to=2025-03-15"),
      });

      expect(result.current.filters.date_from).toBe("2025-03-01");
      expect(result.current.filters.date_to).toBe("2025-03-15");
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe("export filter", () => {
    it("includes current month dates when viewing default", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      const expected = expectedDefaultRange();
      expect(result.current.exportFilter.since).toBe(expected.date_from);
      expect(result.current.exportFilter.until).toBe(expected.date_to);
    });

    it("reflects custom date range in export filter", () => {
      const { result } = renderHook(() => useReportsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setFilter({ date_from: "2026-03-01", date_to: "2026-03-31" });
      });

      expect(result.current.exportFilter.since).toBe("2026-03-01");
      expect(result.current.exportFilter.until).toBe("2026-03-31");
    });
  });
});
