/**
 * Punch filter handlers — API key contract test.
 *
 * Validates Issue #5 fix: the filter handlers MUST output `user_pins` (array)
 * not `user_pin` (singular), as the backend API only reads the plural form.
 *
 * This test exists to prevent silent data mismatches between frontend filter
 * state and the backend API query parameter expectations.
 */
import { describe, it, expect, vi } from "vitest";
import { usePunchFilterHandlers } from "./use-punch-filter-handlers";
import { renderHook, act } from "@testing-library/react";

describe("usePunchFilterHandlers", () => {
  it("handleSearchChange with digits → passes user_pins as array", () => {
    const handleFilterChange = vi.fn();
    const setDeviceSns = vi.fn();

    const { result } = renderHook(() =>
      usePunchFilterHandlers(handleFilterChange, setDeviceSns),
    );

    act(() => {
      result.current.handleSearchChange("1001");
    });

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    const patch = handleFilterChange.mock.calls[0][0] as Record<string, unknown>;

    // MUST be user_pins (plural array), NOT user_pin (singular string)
    expect(patch.user_pins).toEqual(["1001"]);
    expect((patch as any).user_pin).toBeUndefined();
    expect(patch.search).toBeUndefined();
  });

  it("handleSearchChange with text → passes search string, clears user_pins", () => {
    const handleFilterChange = vi.fn();
    const setDeviceSns = vi.fn();

    const { result } = renderHook(() =>
      usePunchFilterHandlers(handleFilterChange, setDeviceSns),
    );

    act(() => {
      result.current.handleSearchChange("Alice");
    });

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    const patch = handleFilterChange.mock.calls[0][0] as Record<string, unknown>;

    expect(patch.search).toBe("Alice");
    expect(patch.user_pins).toBeUndefined();
  });

  it("handleSearchChange with empty string → clears both", () => {
    const handleFilterChange = vi.fn();
    const setDeviceSns = vi.fn();

    const { result } = renderHook(() =>
      usePunchFilterHandlers(handleFilterChange, setDeviceSns),
    );

    act(() => {
      result.current.handleSearchChange("");
    });

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    const patch = handleFilterChange.mock.calls[0][0] as Record<string, unknown>;

    expect(patch.search).toBeUndefined();
    expect(patch.user_pins).toBeUndefined();
  });

  it("handleAnomaliesOnlyToggle → passes anomalies_only string", () => {
    const handleFilterChange = vi.fn();
    const setDeviceSns = vi.fn();

    const { result } = renderHook(() =>
      usePunchFilterHandlers(handleFilterChange, setDeviceSns),
    );

    act(() => {
      result.current.handleAnomaliesOnlyToggle(true);
    });

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    const patch = handleFilterChange.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.anomalies_only).toBe("true");
  });

  it("handleAnomaliesOnlyToggle with false → clears anomalies_only", () => {
    const handleFilterChange = vi.fn();
    const setDeviceSns = vi.fn();

    const { result } = renderHook(() =>
      usePunchFilterHandlers(handleFilterChange, setDeviceSns),
    );

    act(() => {
      result.current.handleAnomaliesOnlyToggle(false);
    });

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    const patch = handleFilterChange.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.anomalies_only).toBeUndefined();
  });
});
