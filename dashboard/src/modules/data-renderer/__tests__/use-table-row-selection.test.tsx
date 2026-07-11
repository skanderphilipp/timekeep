import React from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "jotai";
import { useTableRowSelection } from "../hooks/use-table-row-selection";

const wrapper = ({ children }: { children: React.ReactNode }) => <Provider>{children}</Provider>;

describe("useTableRowSelection", () => {
  const instanceId = "test-table-3";
  const allRowIds = ["row-1", "row-2", "row-3"];

  it("starts with no rows selected", () => {
    const { result } = renderHook(() => useTableRowSelection(instanceId, allRowIds), { wrapper });
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.allSelected).toBe(false);
  });

  it("toggles a single row", () => {
    const { result } = renderHook(() => useTableRowSelection(instanceId, allRowIds), { wrapper });

    act(() => result.current.handleToggleRow("row-1"));
    expect(result.current.isSelected("row-1")).toBe(true);
    expect(result.current.isSelected("row-2")).toBe(false);

    act(() => result.current.handleToggleRow("row-1"));
    expect(result.current.isSelected("row-1")).toBe(false);
  });

  it("selects all rows", () => {
    const { result } = renderHook(() => useTableRowSelection(instanceId, allRowIds), { wrapper });

    act(() => result.current.handleSelectAll());
    expect(result.current.allSelected).toBe(true);
    expect(result.current.isSelected("row-1")).toBe(true);
    expect(result.current.isSelected("row-2")).toBe(true);
    expect(result.current.isSelected("row-3")).toBe(true);
  });

  it("deselects all when toggling from all-selected state", () => {
    const { result } = renderHook(() => useTableRowSelection(instanceId, allRowIds), { wrapper });

    // Select all
    act(() => result.current.handleSelectAll());
    expect(result.current.allSelected).toBe(true);

    // Toggle again — deselect all
    act(() => result.current.handleSelectAll());
    expect(result.current.allSelected).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });
});
