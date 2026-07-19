/**
 * Integration test: useInfinitePunchQuery filter -> API bridge.
 *
 * Validates the FULL pipeline: handler -> URL params -> local state -> API call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";

import { useInfinitePunchQuery } from "../use-punch-query-infinite";
import { usePunchFilterHandlers } from "../use-punch-filter-handlers";

vi.mock("@/lib/api/punches", () => ({
  fetchPunchesCursor: vi.fn(),
}));

import { fetchPunchesCursor } from "@/lib/api/punches";

let queryClient: QueryClient;

function makeWrapper(initialPath = "/attendance") {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      createElement(QueryClientProvider, { client: queryClient }, children),
    );
  };
}

async function settleInitialFetch() {
  await waitFor(() => {
    expect(fetchPunchesCursor).toHaveBeenCalled();
  });
  vi.mocked(fetchPunchesCursor).mockClear();
}

describe("useInfinitePunchQuery -- filter to API bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPunchesCursor).mockResolvedValue({
      punches: [],
      has_more: false,
      next_cursor: null,
    });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it("passes user_pins to the API when set via filter change", async () => {
    const { result } = renderHook(() => useInfinitePunchQuery(), {
      wrapper: makeWrapper(),
    });
    await settleInitialFetch();

    await act(async () => {
      result.current.handleFilterChange({ user_pins: ["12345"] } as any);
    });

    await waitFor(() => {
      expect(fetchPunchesCursor).toHaveBeenCalled();
    });

    const filterArg = vi.mocked(fetchPunchesCursor).mock.calls[0]?.[0];
    expect(filterArg?.user_pins).toEqual(["12345"]);
  });

  it("local state reflects filter changes for chip display", async () => {
    const { result } = renderHook(() => useInfinitePunchQuery(), {
      wrapper: makeWrapper(),
    });
    await settleInitialFetch();

    await act(async () => {
      result.current.handleFilterChange({ user_pins: ["99999"] } as any);
    });

    await waitFor(() => {
      expect(result.current.filters.user_pins).toEqual(["99999"]);
    });
  });

  it("handleClearFilters clears user_pins from local state", async () => {
    const { result } = renderHook(() => useInfinitePunchQuery(), {
      wrapper: makeWrapper(),
    });
    await settleInitialFetch();

    await act(async () => {
      result.current.handleFilterChange({ user_pins: ["12345"] } as any);
    });
    await waitFor(() => {
      expect(result.current.filters.user_pins).toEqual(["12345"]);
    });

    await act(async () => {
      result.current.handleClearFilters();
    });
    await waitFor(() => {
      expect(result.current.filters.user_pins).toBeUndefined();
    });
  });

  it("e2e: handleSearchChange('12345') -> API receives user_pins: ['12345']", async () => {
    const { result } = renderHook(() => {
      const query = useInfinitePunchQuery();
      const handlers = usePunchFilterHandlers(
        query.handleFilterChange,
        query.setDeviceSns,
      );
      return { query, handlers };
    }, { wrapper: makeWrapper() });
    await settleInitialFetch();

    await act(async () => {
      result.current.handlers.handleSearchChange("12345");
    });

    await waitFor(() => {
      expect(fetchPunchesCursor).toHaveBeenCalled();
    });

    const filterArg2 = vi.mocked(fetchPunchesCursor).mock.calls[0]?.[0];
    expect(filterArg2?.user_pins).toEqual(["12345"]);
  });

  it("e2e: handleSearchChange('Alice') -> API receives search: Alice", async () => {
    const { result } = renderHook(() => {
      const query = useInfinitePunchQuery();
      const handlers = usePunchFilterHandlers(
        query.handleFilterChange,
        query.setDeviceSns,
      );
      return { query, handlers };
    }, { wrapper: makeWrapper() });
    await settleInitialFetch();

    await act(async () => {
      result.current.handlers.handleSearchChange("Alice");
    });

    await waitFor(() => {
      const calls = vi.mocked(fetchPunchesCursor).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]?.search).toBe("Alice");
    });
  });
});
