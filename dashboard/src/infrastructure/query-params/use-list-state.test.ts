import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";
import { useListState } from "./use-list-state";

// ── Wrapper factory ──────────────────────────────────────────────────────

function makeWrapper(initialUrl = "/") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries: [initialUrl] },
      children,
    );
  };
}

// ── Test defaults ────────────────────────────────────────────────────────

const defaults = {
  status: "",
  verify_mode: "",
  device_sn: "",
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("useListState", () => {
  // ── Filter + Page Atomicity ──────────────────────────────────────────

  describe("setFilter (atomic filter + page reset)", () => {
    it("sets a filter value and resets the page to 1 in a single URL update", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        { wrapper: makeWrapper() },
      );

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      expect(result.current.filters.status).toBe("check_in");
      expect(result.current.page).toBe(1);
    });

    it("preserves existing filter params when setting a different filter", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        { wrapper: makeWrapper("/?test_device_sn=DEV-001&test_page=2") },
      );

      expect(result.current.filters.device_sn).toBe("DEV-001");

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      // New status filter should be set
      expect(result.current.filters.status).toBe("check_in");
      // Existing device_sn should be preserved (setFilter merges URL params)
      expect(result.current.filters.device_sn).toBe("DEV-001");
      // Page should reset to 1
      expect(result.current.page).toBe(1);
    });

    it("clears a filter field when set to empty string", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      expect(result.current.filters.status).toBe("check_in");

      act(() => {
        result.current.setFilter({ status: "" });
      });

      expect(result.current.filters.status).toBe("");
    });

    it("clears a filter field when set to undefined", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      act(() => {
        result.current.setFilter({ status: undefined });
      });

      expect(result.current.filters.status).toBe("");
    });

    it("sets multiple filter fields at once", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        { wrapper: makeWrapper() },
      );

      act(() => {
        result.current.setFilter({
          status: "check_out",
          verify_mode: "fingerprint",
        });
      });

      expect(result.current.filters.status).toBe("check_out");
      expect(result.current.filters.verify_mode).toBe("fingerprint");
    });

    it("returns correct filter values immediately after set", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        { wrapper: makeWrapper() },
      );

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      expect(result.current.filters.status).toBe("check_in");
      expect(result.current.filters.verify_mode).toBe("");
      expect(result.current.filters.device_sn).toBe("");
    });
  });

  // ── Page Reset ────────────────────────────────────────────────────────

  describe("page reset on filter change", () => {
    it("resets page to 1 when a filter changes", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        { wrapper: makeWrapper("/?test_page=5") },
      );

      expect(result.current.page).toBe(5);

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      expect(result.current.page).toBe(1);
    });
  });

  // ── Sort + Page Atomicity ────────────────────────────────────────────

  describe("setSort (atomic sort + page reset)", () => {
    it("sets sort state and resets page without touching filters", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        {
          wrapper: makeWrapper(
            "/?test_page=5&test_status=check_in",
          ),
        },
      );

      act(() => {
        result.current.setSort({ column: "timestamp", direction: "asc" });
      });

      expect(result.current.sort).toEqual({
        column: "timestamp",
        direction: "asc",
      });
      expect(result.current.page).toBe(1);
      // Existing filter should survive setSort
      expect(result.current.filters.status).toBe("check_in");
    });
  });

  describe("toggleSort (atomic sort toggle + page reset)", () => {
    it("cycles through asc → desc → none and resets page", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        {
          wrapper: makeWrapper(
            "/?test_page=3&test_status=check_in",
          ),
        },
      );

      // First toggle: asc
      act(() => {
        result.current.toggleSort("timestamp");
      });
      expect(result.current.sort).toEqual({
        column: "timestamp",
        direction: "asc",
      });
      expect(result.current.page).toBe(1);

      // Second toggle: desc
      act(() => {
        result.current.toggleSort("timestamp");
      });
      expect(result.current.sort?.direction).toBe("desc");

      // Third toggle: none
      act(() => {
        result.current.toggleSort("timestamp");
      });
      expect(result.current.sort).toBeNull();
    });
  });

  // ── Reset Filters ────────────────────────────────────────────────────

  describe("resetFilters (atomic reset + page 1)", () => {
    it("clears all filter params and resets page", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            defaultPage: 1,
          }),
        {
          wrapper: makeWrapper(
            "/?test_status=check_in&test_device_sn=DEV-001&test_page=5",
          ),
        },
      );

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.status).toBe("");
      expect(result.current.filters.device_sn).toBe("");
      expect(result.current.page).toBe(1);
    });
  });

  // ── hasActiveFilters ─────────────────────────────────────────────────

  describe("hasActiveFilters", () => {
    it("returns false when all filters match defaults", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
          }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("returns true when any filter differs from default", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
          }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  // ── Query Key ────────────────────────────────────────────────────────

  describe("queryKey", () => {
    it("includes namespace, filters, sort, and page", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
            sortDefaults: { column: "timestamp", direction: "desc" },
          }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.queryKey).toEqual([
        "test",
        "status",
        "",
        "verify_mode",
        "",
        "device_sn",
        "",
        "timestamp:desc",
        "page:1",
      ]);
    });

    it("changes when a filter is set", () => {
      const { result } = renderHook(
        () =>
          useListState({
            namespace: "test",
            filterDefaults: defaults,
          }),
        { wrapper: makeWrapper() },
      );

      const keyBefore = result.current.queryKey;

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      expect(result.current.queryKey).not.toEqual(keyBefore);
    });
  });
});
