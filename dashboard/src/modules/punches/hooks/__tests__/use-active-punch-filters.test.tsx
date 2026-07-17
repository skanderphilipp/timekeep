import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { ReactNode } from "react";

import { useActivePunchFilters } from "../use-active-punch-filters";

// ── Lingui setup ─────────────────────────────────────────────────────────
// The `msg` macro from @lingui/core/macro is compiled by the SWC plugin.
// We don't mock it — we initialize i18n properly so translations work.

i18n.load({ en: {} });
i18n.activate("en");

function Wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("useActivePunchFilters", () => {
  it("returns empty array when no filters are active", () => {
    const { result } = renderHook(
      () => useActivePunchFilters({}, vi.fn()),
      { wrapper: Wrapper },
    );
    expect(result.current).toHaveLength(0);
  });

  it("creates a chip for user_pins search with accent color", () => {
    const { result } = renderHook(
      () => useActivePunchFilters({ user_pins: ["42"] }, vi.fn()),
      { wrapper: Wrapper },
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].key).toBe("user_pin_42");
    expect(result.current[0].color).toBe("accent");
    expect(result.current[0].label).toContain("42");
  });

  it("creates chips for multi-device filtering", () => {
    const labelBySn = new Map([
      ["DEV-001", "Office Entrance"],
      ["DEV-002", "Warehouse"],
    ]);

    const { result } = renderHook(
      () =>
        useActivePunchFilters(
          { device_sns: ["DEV-001", "DEV-002"] },
          vi.fn(),
          labelBySn,
        ),
      { wrapper: Wrapper },
    );

    expect(result.current).toHaveLength(2);
    expect(result.current[0].key).toBe("device_DEV-001");
    expect(result.current[0].color).toBe("green");
    expect(result.current[0].label).toContain("Office Entrance");
  });

  it("creates a chip for single device_sns", () => {
    const labelBySn = new Map([["DEV-001", "Main Gate"]]);
    const { result } = renderHook(
      () =>
        useActivePunchFilters(
          { device_sns: ["DEV-001"] },
          vi.fn(),
          labelBySn,
        ),
      { wrapper: Wrapper },
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].color).toBe("green");
  });

  it("creates date range chips with gray color", () => {
    const { result } = renderHook(
      () =>
        useActivePunchFilters(
          { since: "2026-07-01", until: "2026-07-15" },
          vi.fn(),
        ),
      { wrapper: Wrapper },
    );

    expect(result.current).toHaveLength(2);
    expect(result.current[0].key).toBe("since");
    expect(result.current[0].color).toBe("gray");
    expect(result.current[1].key).toBe("until");
  });

  it("creates a status chip with green color", () => {
    const { result } = renderHook(
      () => useActivePunchFilters({ status: "check_in" }, vi.fn()),
      { wrapper: Wrapper },
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].key).toBe("status");
    expect(result.current[0].color).toBe("green");
  });

  it("creates a verify_mode chip with blue color and human-readable label", () => {
    const { result } = renderHook(
      () => useActivePunchFilters({ verify_mode: "face" }, vi.fn()),
      { wrapper: Wrapper },
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].key).toBe("verify_mode");
    expect(result.current[0].color).toBe("blue");
    expect(result.current[0].label).toContain("Face");
  });

  it("falls back to raw value for unknown verify_mode", () => {
    const { result } = renderHook(
      () => useActivePunchFilters({ verify_mode: "unknown" }, vi.fn()),
      { wrapper: Wrapper },
    );
    expect(result.current[0].label).toContain("unknown");
    expect(result.current[0].color).toBe("blue");
  });

  it("creates an anomalies chip with amber warning color", () => {
    const { result } = renderHook(
      () => useActivePunchFilters({ anomalies_only: "true" }, vi.fn()),
      { wrapper: Wrapper },
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].key).toBe("anomalies_only");
    expect(result.current[0].color).toBe("amber");
  });

  it("returns all active filters at once", () => {
    const { result } = renderHook(
      () =>
        useActivePunchFilters(
          {
            user_pins: ["42"],
            status: "check_in",
            verify_mode: "fingerprint",
            anomalies_only: "true",
            since: "2026-07-15",
          },
          vi.fn(),
        ),
      { wrapper: Wrapper },
    );

    expect(result.current).toHaveLength(5);
    const keys = result.current.map((c) => c.key);
    expect(keys).toEqual([
      "user_pin_42",
      "since",
      "status",
      "verify_mode",
      "anomalies_only",
    ]);
  });

  it("calls onRemove with the correct patch when a chip is dismissed", () => {
    const handleChange = vi.fn();
    const { result } = renderHook(
      () => useActivePunchFilters({ status: "check_in" }, handleChange),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current[0].onRemove();
    });

    expect(handleChange).toHaveBeenCalledWith({ status: undefined });
  });

  it("ignores empty/undefined filter values", () => {
    const { result } = renderHook(
      () =>
        useActivePunchFilters(
          { status: "", verify_mode: undefined, anomalies_only: "" },
          vi.fn(),
        ),
      { wrapper: Wrapper },
    );
    expect(result.current).toHaveLength(0);
  });
});
