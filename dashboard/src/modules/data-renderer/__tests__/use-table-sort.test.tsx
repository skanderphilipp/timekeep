import React from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "jotai";
import { useTableSort } from "../hooks/use-table-sort";

const wrapper = ({ children }: { children: React.ReactNode }) => <Provider>{children}</Provider>;

describe("useTableSort", () => {
  const instanceId = "test-table-1";

  it("starts with empty sorts", () => {
    const { result } = renderHook(() => useTableSort(instanceId), { wrapper });
    expect(result.current.sorts).toEqual([]);
  });

  it("toggles sort: none → asc → desc → none", () => {
    const { result } = renderHook(() => useTableSort(instanceId), { wrapper });

    // First click: asc
    act(() => result.current.toggleSort("timestamp"));
    expect(result.current.sorts).toEqual([{ columnId: "timestamp", direction: "asc" }]);

    // Second click: desc
    act(() => result.current.toggleSort("timestamp"));
    expect(result.current.sorts).toEqual([{ columnId: "timestamp", direction: "desc" }]);

    // Third click: removed
    act(() => result.current.toggleSort("timestamp"));
    expect(result.current.sorts).toEqual([]);
  });

  it("setSort replaces all sorts", () => {
    const { result } = renderHook(() => useTableSort(instanceId), { wrapper });

    act(() => result.current.setSort("device_sn", "desc"));
    expect(result.current.sorts).toEqual([{ columnId: "device_sn", direction: "desc" }]);

    act(() => result.current.setSort("user_pin", "asc"));
    expect(result.current.sorts).toEqual([{ columnId: "user_pin", direction: "asc" }]);
  });

  it("clearSort removes all sorts", () => {
    const { result } = renderHook(() => useTableSort(instanceId), { wrapper });

    act(() => result.current.toggleSort("timestamp"));
    expect(result.current.sorts).toHaveLength(1);

    act(() => result.current.clearSort());
    expect(result.current.sorts).toEqual([]);
  });
});
