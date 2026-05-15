import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";
import type { ReactNode } from "react";

import { usePunchFacetOptions } from "./use-punch-facet-options";

i18n.load({ en: enMessages });
i18n.activate("en");

// ── Mock the API ─────────────────────────────────────────────────────────────

const mockFetchPunchFilters = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchPunchFilters: (...args: unknown[]) => mockFetchPunchFilters(...args),
}));

// ── Test wrapper ─────────────────────────────────────────────────────────────

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  mockFetchPunchFilters.mockReset();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("usePunchFacetOptions", () => {
  // ── Device options ──

  it("returns device options from the facet endpoint", async () => {
    mockFetchPunchFilters.mockResolvedValueOnce([
      {
        key: "device_sn",
        label: "Device",
        kind: "enum",
        has_more: false,
        options: [
          { value: "DEV-001", label: "Main Gate", count: 142 },
          { value: "DEV-002", label: "Warehouse", count: 88 },
        ],
      },
    ]);

    const { result } = renderHook(() => usePunchFacetOptions(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.devicesLoading).toBe(false);
    });

    expect(result.current.deviceOptions).toHaveLength(3); // "All Devices" + 2 devices
    expect(result.current.deviceOptions[1].label).toBe("Main Gate");
    expect(result.current.deviceOptions[1].value).toBe("DEV-001");
    // Count suffix should be present
    expect(result.current.deviceOptions[1].suffix).toBeDefined();
  });

  it("returns empty device options when API returns no data", async () => {
    mockFetchPunchFilters.mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePunchFacetOptions(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.devicesLoading).toBe(false);
    });

    expect(result.current.deviceOptions).toHaveLength(1); // Only "All Devices"
    expect(result.current.deviceOptions[0].label).toBe("All Devices");
  });

  it("builds labelBySn map from device options", async () => {
    mockFetchPunchFilters.mockResolvedValueOnce([
      {
        key: "device_sn",
        label: "Device",
        kind: "enum",
        has_more: false,
        options: [
          { value: "DEV-001", label: "Main Gate", count: 50 },
          { value: "DEV-002", label: "Warehouse", count: 30 },
        ],
      },
    ]);

    const { result } = renderHook(() => usePunchFacetOptions(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.devicesLoading).toBe(false);
    });

    expect(result.current.labelBySn.get("DEV-001")).toBe("Main Gate");
    expect(result.current.labelBySn.get("DEV-002")).toBe("Warehouse");
    expect(result.current.labelBySn.get("NONEXISTENT")).toBeUndefined();
  });

  // ── Contextual counts ──

  it("passes contextual filters to the facet endpoint", async () => {
    mockFetchPunchFilters.mockResolvedValueOnce([]);

    renderHook(
      () =>
        usePunchFacetOptions({
          since: "1751300000",
          until: "1752000000",
          status: "check_in",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(mockFetchPunchFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          since: "1751300000",
          until: "1752000000",
          status: "check_in",
        }),
      );
    });
  });

  // ── Employee search ──

  it("does not fetch employee options until search query >= 2 characters", async () => {
    mockFetchPunchFilters.mockResolvedValueOnce([]); // device query
    mockFetchPunchFilters.mockResolvedValueOnce([]); // employee query (if fired)

    const { result } = renderHook(() => usePunchFacetOptions(), { wrapper: Wrapper });

    // Wait for device query
    await waitFor(() => {
      expect(result.current.devicesLoading).toBe(false);
    });

    // Search with < 2 characters — should NOT fire employee query
    result.current.searchEmployees("A");

    // The employee query should not have been called (device call was already made)
    // Device call: dimension=device_sn, Employee call would be: dimension=employee&search=A
    const employeeCalls = mockFetchPunchFilters.mock.calls.filter(
      (call) => call[0]?.dimension === "employee",
    );
    expect(employeeCalls).toHaveLength(0);
  });

  it("resets employee search state", async () => {
    mockFetchPunchFilters.mockResolvedValueOnce([]); // device query

    const { result } = renderHook(() => usePunchFacetOptions(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.devicesLoading).toBe(false);
    });

    result.current.resetEmployeeSearch();

    // Employee query should not have fired (since reset clears the query)
    const employeeCalls = mockFetchPunchFilters.mock.calls.filter(
      (call) => call[0]?.dimension === "employee" && call[0]?.search !== "",
    );
    expect(employeeCalls).toHaveLength(0);
  });
});
