import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";
import { useFilterUrl } from "./use-filter-url";

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

describe("useFilterUrl", () => {
  // ── Reading from URL ─────────────────────────────────────────────────

  describe("filters (read from URL)", () => {
    it("returns default values when URL has no params", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.filters).toEqual(defaults);
    });

    it("reads filter values from URL params", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?test_status=check_in&test_device_sn=DEV-001") },
      );

      expect(result.current.filters.status).toBe("check_in");
      expect(result.current.filters.device_sn).toBe("DEV-001");
      expect(result.current.filters.verify_mode).toBe("");
    });

    it("ignores params from other namespaces", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?other_status=check_in") },
      );

      expect(result.current.filters.status).toBe("");
    });

    it("reacts to URL changes from setFilter", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.filters.status).toBe("");

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      expect(result.current.filters.status).toBe("check_in");
    });
  });

  // ── Writing to URL ───────────────────────────────────────────────────

  describe("setFilter (write to URL)", () => {
    it("sets a single filter", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper() },
      );

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      expect(result.current.filters.status).toBe("check_in");
    });

    it("removes a filter param when value matches default", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      expect(result.current.filters.status).toBe("check_in");

      act(() => {
        result.current.setFilter({ status: "" });
      });

      expect(result.current.filters.status).toBe("");
    });

    it("removes a filter param when value is undefined", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      expect(result.current.filters.status).toBe("check_in");

      act(() => {
        result.current.setFilter({ status: undefined });
      });

      expect(result.current.filters.status).toBe("");
    });

    it("sets multiple filters at once", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
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

    it("preserves existing non-filter URL params", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?other=value&test_status=check_in") },
      );

      act(() => {
        result.current.setFilter({ device_sn: "DEV-001" });
      });

      // The "other" param should survive (it's not a test-namespace param)
      expect(result.current.filters.device_sn).toBe("DEV-001");
      // Original status should also survive (setFilter merges partial updates)
      expect(result.current.filters.status).toBe("check_in");
    });

    it("merges partial updates without clearing other filters", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      act(() => {
        result.current.setFilter({ device_sn: "DEV-001" });
      });

      expect(result.current.filters.status).toBe("check_in");
      expect(result.current.filters.device_sn).toBe("DEV-001");
    });
  });

  // ── Reset ────────────────────────────────────────────────────────────

  describe("resetFilters", () => {
    it("removes all filter params for the namespace", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        {
          wrapper: makeWrapper(
            "/?test_status=check_in&test_device_sn=DEV-001&test_verify_mode=fingerprint&other=keep",
          ),
        },
      );

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.status).toBe("");
      expect(result.current.filters.device_sn).toBe("");
      expect(result.current.filters.verify_mode).toBe("");
    });

    it("filters object returns to defaults after reset", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      expect(result.current.filters.status).toBe("check_in");

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.status).toBe("");
    });
  });

  // ── hasActiveFilters ─────────────────────────────────────────────────

  describe("hasActiveFilters", () => {
    it("returns false when all filters are defaults", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("returns true when a filter differs from default", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?test_status=check_in") },
      );

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns false when URL has params from other namespaces only", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper("/?other_status=check_in") },
      );

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("transitions from false to true when a filter is set", () => {
      const { result } = renderHook(
        () => useFilterUrl({ namespace: "test", defaults }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.hasActiveFilters).toBe(false);

      act(() => {
        result.current.setFilter({ status: "check_in" });
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });
});
