/**
 * Integration test: Inline edit mutation MUST keep list and detail caches in sync.
 *
 * This test validates the fix for Issues #2 and #3:
 *   - After editing a field via the inline edit mutation, BOTH the list query
 *     cache and the detail query cache reflect the updated value.
 *   - Before the fix, only the list cache was updated — the detail cache
 *     (used by the side panel) remained stale.
 *
 * Testing pattern: renders the inline edit mutation, seeds the cache with
 * known data, executes a mutation, then asserts both caches are consistent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useRecordInlineEdit } from "./use-record-inline-edit";
import { QueryKeys } from "@/lib/query-keys";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/employees", () => ({
  updateEmployee: vi.fn(),
}));

vi.mock("@/lib/api/departments", () => ({
  updateDepartment: vi.fn(),
}));

vi.mock("@/lib/api/devices", () => ({
  updateDevice: vi.fn(),
}));

vi.mock("@/lib/api/users", () => ({
  updateUser: vi.fn(),
}));

vi.mock("@/lib/api/integrations", () => ({
  updateEndpoint: vi.fn(),
}));

vi.mock("@/lib/api/device-groups", () => ({
  updateDeviceGroup: vi.fn(),
}));

vi.mock("@/lib/api/work-policies", () => ({
  updateWorkPolicyTemplate: vi.fn(),
}));

import { updateEmployee } from "@/lib/api/employees";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useRecordInlineEdit — cache consistency (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically updates BOTH the list and detail caches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    // Seed both caches with initial data
    const listKey = QueryKeys.employees.list();
    const detailKey = QueryKeys.entityDetail.detail("employee", "emp-1");

    queryClient.setQueryData(listKey, [
      { id: "emp-1", name: "Alice", pin: "1001" },
      { id: "emp-2", name: "Bob", pin: "2002" },
    ]);
    queryClient.setQueryData(detailKey, {
      id: "emp-1",
      name: "Alice",
      pin: "1001",
      department: "Engineering",
    });

    // Resolve the mutation to a new record
    vi.mocked(updateEmployee).mockResolvedValue({
      id: "emp-1",
      name: "Alice Updated",
      pin: "1001",
      department: "Engineering",
    } as never);

    const { result } = renderHook(() => useRecordInlineEdit("employee"), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({
      rowId: "emp-1",
      field: "name",
      value: "Alice Updated",
    });

    await waitFor(() => {
      expect(updateEmployee).toHaveBeenCalled();
    });

    // ── Assert LIST cache updated ────────────────────────────────────────
    const list = queryClient.getQueryData<Record<string, unknown>[]>(listKey);
    expect(list).toBeDefined();
    const updatedRow = list!.find((r) => r.id === "emp-1");
    expect(updatedRow).toBeDefined();
    expect(updatedRow!.name).toBe("Alice Updated");

    // ── Assert DETAIL cache updated ───────────────────────────────────────
    const detail = queryClient.getQueryData<Record<string, unknown>>(detailKey);
    expect(detail).toBeDefined();
    expect(detail!.name).toBe("Alice Updated");

    // ── Other fields preserved ────────────────────────────────────────────
    expect(updatedRow!.pin).toBe("1001");
    expect(detail!.department).toBe("Engineering");
  });

  it("rolls back BOTH caches on mutation error", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const listKey = QueryKeys.employees.list();
    const detailKey = QueryKeys.entityDetail.detail("employee", "emp-1");

    const initialName = "Alice";
    queryClient.setQueryData(listKey, [
      { id: "emp-1", name: initialName, pin: "1001" },
    ]);
    queryClient.setQueryData(detailKey, {
      id: "emp-1",
      name: initialName,
      pin: "1001",
    });

    vi.mocked(updateEmployee).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useRecordInlineEdit("employee"), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({
      rowId: "emp-1",
      field: "name",
      value: "Should Roll Back",
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Both caches should be back to original values
    const list = queryClient.getQueryData<Record<string, unknown>[]>(listKey);
    expect(list![0].name).toBe(initialName);

    const detail = queryClient.getQueryData<Record<string, unknown>>(
      detailKey,
    );
    expect(detail!.name).toBe(initialName);
  });

  it("does not touch detail cache for entities not in the registry", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useRecordInlineEdit("punch"), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({
      rowId: "p1",
      field: "status",
      value: "check_in",
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toContain(
        "Inline edit not supported",
      );
    });
  });
});
