import React from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "jotai";
import { useTableFilter } from "../hooks/use-table-filter";

const wrapper = ({ children }: { children: React.ReactNode }) => <Provider>{children}</Provider>;

describe("useTableFilter", () => {
  const instanceId = "test-table-2";

  it("starts with empty filters", () => {
    const { result } = renderHook(() => useTableFilter(instanceId), { wrapper });
    expect(result.current.filters).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("sets a filter for a column", () => {
    const { result } = renderHook(() => useTableFilter(instanceId), { wrapper });

    act(() => result.current.setFilter({ columnId: "device_sn", value: "ABC123" }));
    expect(result.current.filters).toEqual([{ columnId: "device_sn", value: "ABC123" }]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("updates an existing filter", () => {
    const { result } = renderHook(() => useTableFilter(instanceId), { wrapper });

    act(() => result.current.setFilter({ columnId: "device_sn", value: "ABC123" }));
    act(() => result.current.setFilter({ columnId: "device_sn", value: "XYZ789" }));
    expect(result.current.filters).toEqual([{ columnId: "device_sn", value: "XYZ789" }]);
  });

  it("removes a filter when value is empty", () => {
    const { result } = renderHook(() => useTableFilter(instanceId), { wrapper });

    act(() => result.current.setFilter({ columnId: "device_sn", value: "ABC123" }));
    act(() => result.current.setFilter({ columnId: "device_sn", value: "" }));
    expect(result.current.filters).toEqual([]);
  });

  it("removes a filter by column ID", () => {
    const { result } = renderHook(() => useTableFilter(instanceId), { wrapper });

    act(() => result.current.setFilter({ columnId: "device_sn", value: "ABC123" }));
    act(() => result.current.removeFilter("device_sn"));
    expect(result.current.filters).toEqual([]);
  });

  it("clears all filters", () => {
    const { result } = renderHook(() => useTableFilter(instanceId), { wrapper });

    act(() => result.current.setFilter({ columnId: "a", value: "1" }));
    act(() => result.current.setFilter({ columnId: "b", value: "2" }));
    expect(result.current.filters).toHaveLength(2);

    act(() => result.current.clearFilters());
    expect(result.current.filters).toEqual([]);
  });
});
